import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MotionMonitor from '../sensors/MotionMonitor';
import HeartRateMonitor from '../sensors/HeartRateMonitor';
import DetectionEngine from '../sensors/DetectionEngine';
import ShakeGestureMonitor from '../sensors/ShakeGestureMonitor';

export const GlobalContext = createContext();

const DEFAULT_USER_PROFILE = {
  name: '',
  phone: '',
  profilePicture: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  wearableMonitoringEnabled: false,
  // Fake-call decoy (see FakeCallScreen.js) — shortcut is on by default, caller identity
  // is customizable from ProfileScreen so it looks like a real, expected contact.
  fakeCallShortcutEnabled: true,
  fakeCallerName: '',
  fakeCallerPhoto: '',
  // Shake-gesture SOS (see ShakeGestureMonitor.js / useShakeSOSTrigger below) — unlike
  // the fake-call shortcut this can fire a real SOS, so it defaults OFF (opt-in), same
  // posture as wearableMonitoringEnabled above.
  shakeSOSEnabled: false,
};

export const GlobalProvider = ({ children }) => {
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isContextLoaded, setIsContextLoaded] = useState(false);

  // Populated after login (SOSScreen.js needs this to identify the victim & text the contact)
  const [userProfile, setUserProfile] = useState(DEFAULT_USER_PROFILE);

  // Live wearable BLE connection state ('idle'|'scanning'|'connecting'|'connected'|
  // 'disconnected'|'error'), and the list of nearby heart-rate devices startScan() has
  // found so far — both written by useAegisMonitoring()'s HeartRateMonitor callbacks
  // below. Live here in shared context (rather than as local state inside the hook) so
  // any screen — WearableScreen's device picker included — can read/drive the real
  // connection without calling useAegisMonitoring() a second time, which would spin up
  // a second BleManager/scan.
  const [bleStatus, setBleStatus] = useState('idle');
  const [bleDevices, setBleDevices] = useState([]);
  // Latest real heart-rate reading decoded off the connected wearable's GATT
  // notifications (see HeartRateMonitor). 0 whenever there's no live connection —
  // WearableScreen shows this directly rather than any locally-simulated value.
  const [currentBpm, setCurrentBpm] = useState(0);
  // connectToBleDevice(deviceId) is a stable wrapper around whatever the active
  // HeartRateMonitor instance's real connect logic currently is (set into this ref by
  // useAegisMonitoring's effect below) — indirection needed because that instance only
  // exists while monitoring is on, but screens need a stable function to call regardless.
  const connectToBleDeviceRef = useRef(async () => {});
  const connectToBleDevice = (deviceId) => connectToBleDeviceRef.current(deviceId);

  // The currently dispatched SOS record (null when no SOS is active), and any dispatch error
  const [activeSOS, setActiveSOS] = useState(null);
  const [sosError, setSosError] = useState(null);
  const [nearbySOS, setNearbySOS] = useState([]);

  // The currently active shared trip (null when none), independent of SOS — see
  // startTrip/endTrip and the location-post effect below. Lives here (not in
  // TripActiveScreen) so a trip survives navigating away from that screen, same
  // reasoning as activeSOS living here instead of in SOSScreen.
  const [activeTrip, setActiveTrip] = useState(null);

  const toggleSOS = () => setIsSOSActive(!isSOSActive);
  const addNotification = (notification) => setNotifications((prev) => [notification, ...prev]);
  const removeNotification = (id) => {
    const normalizedId = id != null ? String(id) : id;
    return setNotifications((prev) => prev.filter((n) => String(n.id) !== normalizedId));
  };
  const clearNotifications = () => setNotifications([]);
  
  const handleSetUser = async (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    await AsyncStorage.setItem('@aegis_user', JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    setIsLoggedIn(false);
    setUserProfile(DEFAULT_USER_PROFILE);
    await AsyncStorage.multiRemove(['@aegis_user', '@aegis_profile']);
  };

  useEffect(() => {
    const loadState = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@aegis_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsLoggedIn(true);
        }
        const storedProfile = await AsyncStorage.getItem('@aegis_profile');
        if (storedProfile) {
          setUserProfile({ ...DEFAULT_USER_PROFILE, ...JSON.parse(storedProfile) });
        }
      } catch (e) {
        console.error("Failed to load user state", e);
      } finally {
        setIsContextLoaded(true);
      }
    };
    loadState();
  }, []);

  // Persist userProfile (name/phone/emergency contact) so it survives app
  // restarts — mirrors handleSetUser's AsyncStorage pattern above. Gated on
  // isContextLoaded so this doesn't fire with the empty default state and
  // clobber a previously-saved profile before loadState has restored it.
  useEffect(() => {
    if (!isContextLoaded) return;
    AsyncStorage.setItem('@aegis_profile', JSON.stringify(userProfile)).catch((e) =>
      console.error('Failed to persist user profile', e)
    );
  }, [userProfile, isContextLoaded]);

  const normalizePhone = (phone) => {
    if (!phone) return '';
    const cleaned = String(phone).trim();
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (!digitsOnly) return cleaned;
    if (cleaned.startsWith('+')) return cleaned;
    if (digitsOnly.length === 10) return `+91${digitsOnly}`;
    if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) return `+91${digitsOnly.slice(1)}`;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) return `+${digitsOnly}`;
    return `+${digitsOnly}`;
  };

  // detectionMetadata (optional): { reason, heartRate, motionScore, confidence, timestamp }
  // from DetectionEngine, passed through by AutoSOSCountdownModal's timeout path when the
  // wearable monitor fires. Manual SOS (the button) calls this with no arguments, same as
  // before. One function stays the single source of truth for creating an SOS either way.
  // sourceOverride (optional): explicit `source` value for the backend, for trigger paths
  // that aren't "manual button tap" or "wearable auto-detection" — e.g. the shake-gesture
  // trigger passes 'auto_shake' here since it has no HR/motion detectionMetadata of its own.
  const triggerSOS = async (detectionMetadata = null, sourceOverride = null) => {
    if (!location) {
      setSosError('Location not available yet. Please wait for GPS lock.');
      return null;
    }
    try {
      const normalizedUserPhone = normalizePhone(userProfile.phone) || 'Unknown';
      const response = await fetch(`${API_BASE_URL}/api/sos/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: userProfile.name || 'Unknown',
          user_phone: normalizedUserPhone,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          emergency_contact_name: userProfile.emergencyContactName || null,
          emergency_contact_phone: normalizePhone(userProfile.emergencyContactPhone) || null,
          source: sourceOverride || (detectionMetadata ? 'auto_wearable' : 'manual'),
          detection_bpm: detectionMetadata?.heartRate ?? null,
          detection_motion_score: detectionMetadata?.motionScore ?? null,
          detection_confidence: detectionMetadata?.confidence ?? null,
          detection_timestamp: detectionMetadata?.timestamp
            ? new Date(detectionMetadata.timestamp).toISOString()
            : null,
        }),
      });
      if (!response.ok) throw new Error('SOS trigger request failed');
      const data = await response.json();
      setActiveSOS(data);
      setSosError(null);
      return data;
    } catch (err) {
      console.error('SOS trigger failed:', err);
      setSosError('Could not reach AEGIS servers — the emergency SMS will still be sent.');
      return null;
    }
  };

  const cancelSOS = async () => {
    const sosId = activeSOS?.id;
    setActiveSOS(null);
    setIsSOSActive(false);
    if (sosId) {
      try {
        await fetch(`${API_BASE_URL}/api/sos/${sosId}/cancel`, { method: 'PATCH' });
      } catch (err) {
        console.error('SOS cancel failed:', err);
      }
    }
  };

  // opts: { recipientPhone, destinationLabel, destinationLatitude, destinationLongitude, etaMinutes }
  const startTrip = async (opts = {}) => {
    if (!location) {
      return { success: false, error: 'Location not available yet. Please wait for GPS lock.' };
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/api/trips/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_phone: normalizePhone(userProfile.phone) || 'Unknown',
          owner_name: userProfile.name || null,
          recipient_phone: opts.recipientPhone ? normalizePhone(opts.recipientPhone) : null,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          destination_label: opts.destinationLabel || null,
          destination_latitude: opts.destinationLatitude ?? null,
          destination_longitude: opts.destinationLongitude ?? null,
          eta_minutes: opts.etaMinutes ?? null,
        }),
      });
      if (!resp.ok) throw new Error('Trip start request failed');
      const data = await resp.json();
      setActiveTrip(data);
      return { success: true, trip: data };
    } catch (err) {
      console.error('Trip start failed:', err);
      return { success: false, error: 'Could not reach AEGIS servers.' };
    }
  };

  const endTrip = async () => {
    if (!activeTrip) return { success: false, error: 'No active trip.' };
    try {
      const resp = await fetch(`${API_BASE_URL}/api/trips/${activeTrip.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_phone: normalizePhone(userProfile.phone) }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { success: false, error: data.detail || 'Could not end this trip.' };
      }
      setActiveTrip(null);
      return { success: true, trip: data };
    } catch (err) {
      console.error('Trip end failed:', err);
      return { success: false, error: 'Could not reach AEGIS servers.' };
    }
  };

  const fetchNearbySOS = async () => {
    const normalizedUserPhone = normalizePhone(userProfile.phone);
    if (!location || !normalizedUserPhone) return;
    try {
      const params = new URLSearchParams({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        radius: 5,
        exclude_phone: normalizedUserPhone,
      });
      const resp = await fetch(`${API_BASE_URL}/api/sos/active?${params}`);
      if (!resp.ok) return;
      const data = await resp.json();
      const raw = data.sos_events || [];
      // Recompute distances client-side (haversine) to avoid format mismatches
      const haversineKm = (lat1, lon1, lat2, lon2) => {
        const toRad = (v) => (v * Math.PI) / 180.0;
        const R = 6371.0;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.asin(Math.sqrt(a));
      };
      const normalized = raw.map((r) => {
        const lat = Number(r.latitude);
        const lon = Number(r.longitude);
        const d = isFinite(lat) && isFinite(lon) ? haversineKm(location.coords.latitude, location.coords.longitude, lat, lon) : null;
        return { ...r, distance_km: d != null ? Math.round(d * 1000) / 1000 : null };
      });
      normalized.sort((a, b) => {
        const da = Number.isFinite(a.distance_km) ? a.distance_km : Number.POSITIVE_INFINITY;
        const db = Number.isFinite(b.distance_km) ? b.distance_km : Number.POSITIVE_INFINITY;
        return da - db;
      });
      setNearbySOS(normalized);
    } catch (err) {
      console.error('Nearby SOS fetch failed:', err);
    }
  };

  const respondToSOS = async (sosId) => {
    if (!userProfile.phone) {
      return { success: false, error: 'Responder phone is not available.' };
    }
    const responderPhone = normalizePhone(userProfile.phone);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/sos/${sosId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responder_phone: responderPhone,
          responder_name: userProfile.name || 'A community member',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { success: false, error: data.detail || 'Could not respond to this SOS.' };
      }
      await fetchNearbySOS();
      return { success: true, sos: data };
    } catch (err) {
      console.error('Respond to SOS failed:', err);
      return { success: false, error: 'Could not reach AEGIS servers.' };
    }
  };

  const resolveSOS = async (sosId, responderPhone) => {
    if (!responderPhone) {
      return { success: false, error: 'Responder phone is not available.' };
    }
    const normalizedResponderPhone = normalizePhone(responderPhone);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/sos/${sosId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responder_phone: normalizedResponderPhone }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { success: false, error: data.detail || 'Could not resolve this SOS.' };
      }
      await fetchNearbySOS();
      return { success: true, sos: data };
    } catch (err) {
      console.error('Resolve SOS failed:', err);
      return { success: false, error: 'Could not reach AEGIS servers.' };
    }
  };

  useEffect(() => {
    if (!location || !userProfile.phone) return;
    fetchNearbySOS();
    const interval = setInterval(fetchNearbySOS, 3000);
    return () => clearInterval(interval);
  }, [location?.coords?.latitude, location?.coords?.longitude, userProfile.phone]);

  useEffect(() => {
    if (!activeSOS || activeSOS.status === 'cancelled') return;
    const sosIdAtPollTime = activeSOS.id;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/sos/${sosIdAtPollTime}/status`);
        if (!resp.ok) return;
        const data = await resp.json();
        setActiveSOS((current) => {
          if (!current || current.id !== sosIdAtPollTime) return current; // stale response, ignore
          return data;
        });
      } catch (err) {
        console.error('SOS status poll failed:', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeSOS?.id, activeSOS?.status]);

  // Posts the owner's location on every change while a trip is active — mirrors the
  // activeSOS status-poll effect above but POSTs instead of GETs. `location` already
  // ticks every ~2s/2m via watchPositionAsync (below), so this needs no timer of its
  // own; living here (not in TripActiveScreen) means the trip keeps updating even if
  // the owner navigates to another screen.
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'active' || !location) return;
    const tripIdAtPostTime = activeTrip.id;
    const normalizedOwnerPhone = normalizePhone(userProfile.phone);
    fetch(`${API_BASE_URL}/api/trips/${tripIdAtPostTime}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_phone: normalizedOwnerPhone,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }),
    }).catch((err) => console.error('Trip location update failed:', err));
  }, [location?.coords?.latitude, location?.coords?.longitude, activeTrip?.id, activeTrip?.status]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );

      const headingSubscription = await Location.watchHeadingAsync((newHeading) => {
        setLocation((prev) => prev ? { ...prev, coords: { ...prev.coords, heading: newHeading.trueHeading } } : prev);
      });
      
      return () => {
        locationSubscription.remove();
        headingSubscription.remove();
      };
    })();
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        isSOSActive,
        toggleSOS,
        location,
        errorMsg,
        userProfile,
        setUserProfile,
        activeSOS,
        triggerSOS,
        cancelSOS,
        sosError,
        nearbySOS,
        activeTrip,
        startTrip,
        endTrip,
        respondToSOS,
        resolveSOS,
        normalizePhone,
        user,
        setUser: handleSetUser,
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
        isLoggedIn,
        setIsLoggedIn,
        logout,
        isContextLoaded,
        bleStatus,
        setBleStatus,
        bleDevices,
        setBleDevices,
        connectToBleDevice,
        connectToBleDeviceRef,
        currentBpm,
        setCurrentBpm,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

// useAegisMonitoring — wires MotionMonitor + HeartRateMonitor + DetectionEngine
// together. Meant to be called once near the app root (inside GlobalProvider,
// sibling to GlobalSOSButton) by a small wrapper that renders
// AutoSOSCountdownModal off the returned state. Gated behind userProfile's
// "enable wearable monitoring" toggle so BLE scanning never starts for anyone
// who hasn't set up a wearable in WearableScreen.js.
export function useAegisMonitoring() {
  const {
    userProfile,
    triggerSOS,
    setBleStatus,
    setBleDevices,
    connectToBleDeviceRef,
    setCurrentBpm,
  } = useContext(GlobalContext);
  const [pendingDetection, setPendingDetection] = useState(null);

  const motionMonitorRef = useRef(null);
  const heartRateMonitorRef = useRef(null);
  const engineRef = useRef(null);
  const pendingDetectionRef = useRef(null); // mirrors state for the async confirm handler below

  useEffect(() => {
    if (!userProfile.wearableMonitoringEnabled) {
      setBleStatus('idle');
      setBleDevices([]);
      setCurrentBpm(0);
      return;
    }

    // If this logs again and again without you touching the Watch Sync toggle, the
    // monitoring pipeline (and its BLE connection) is being torn down and rebuilt by
    // something OTHER than the toggle — e.g. this whole component remounting — which
    // would explain "loses connection after a couple tries" independent of anything
    // BLE-specific. Paired with the "tearing down" log in this effect's cleanup below.
    console.log('[BLE] monitoring pipeline (re)starting — effect fired, wearableMonitoringEnabled=true');

    const engine = new DetectionEngine((detection) => {
      pendingDetectionRef.current = detection;
      setPendingDetection(detection);
    });
    engineRef.current = engine;

    const motionMonitor = new MotionMonitor();
    motionMonitorRef.current = motionMonitor;
    motionMonitor.start((sample) => engine.updateMotion(sample));

    const heartRateMonitor = new HeartRateMonitor();
    heartRateMonitorRef.current = heartRateMonitor;

    // Auto-reconnect: whatever causes a drop (peripheral-side, OS-level, or this
    // pipeline restarting), a safety feature shouldn't just sit there disconnected
    // waiting for someone to notice and re-tap Connect. Remembers the last device you
    // manually chose and retries it a few seconds after any disconnect, a few times,
    // rather than retrying forever if the device is genuinely gone for good.
    let lastDeviceId = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let torndown = false;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const handleStatus = (status, detail) => {
      setBleStatus(status);
      if (status === 'connected') {
        reconnectAttempts = 0;
      }
      // No live link means no live reading — zero the displayed BPM rather than let it
      // sit on the last value from a device that's no longer actually connected.
      if (status === 'disconnected' || status === 'error') {
        setCurrentBpm(0);
      }
      if (status === 'disconnected' && lastDeviceId && !torndown) {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('[BLE] auto-reconnect: giving up after', MAX_RECONNECT_ATTEMPTS, 'attempts');
          return;
        }
        reconnectAttempts += 1;
        console.log(`[BLE] auto-reconnect: retrying in 3s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectTimer = setTimeout(() => {
          if (!torndown) {
            heartRateMonitor.connect(
              lastDeviceId,
              (bpm) => {
                engine.updateHeartRate(bpm);
                setCurrentBpm(bpm);
              },
              handleStatus
            );
          }
        }, 3000);
      }
    };

    // Exposed to WearableScreen (and anywhere else) via GlobalContext's stable
    // connectToBleDevice() wrapper — this is the real implementation it proxies to
    // for as long as this effect instance (i.e. monitoring-on) is alive.
    connectToBleDeviceRef.current = async (deviceId) => {
      lastDeviceId = deviceId;
      reconnectAttempts = 0;
      await heartRateMonitor.connect(
        deviceId,
        (bpm) => {
          engine.updateHeartRate(bpm);
          setCurrentBpm(bpm);
        },
        handleStatus
      );
    };

    setBleDevices([]);
    heartRateMonitor.startScan(
      (device) => setBleDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device])),
      (status) => setBleStatus(status)
    );

    return () => {
      console.log('[BLE] monitoring pipeline tearing down (effect cleanup) — destroying BleManager');
      torndown = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      motionMonitor.stop();
      heartRateMonitor.stop();
      heartRateMonitor.destroy();
      motionMonitorRef.current = null;
      heartRateMonitorRef.current = null;
      engineRef.current = null;
      connectToBleDeviceRef.current = async () => {};
      setCurrentBpm(0);
    };
  }, [userProfile.wearableMonitoringEnabled]);

  const cancelDetection = () => {
    engineRef.current?.cancel();
    pendingDetectionRef.current = null;
    setPendingDetection(null);
  };

  // Returns true/false so AutoSOSCountdownModal can show a real "Sent" vs "Failed"
  // confirmation instead of just silently closing either way.
  const confirmDetection = async () => {
    const detection = pendingDetectionRef.current;
    engineRef.current?.reset();
    pendingDetectionRef.current = null;
    setPendingDetection(null);
    if (!detection) return false;
    const result = await triggerSOS(detection);
    return !!result;
  };

  // bleStatus/bleDevices themselves live in GlobalContext directly now (see above) —
  // any consumer should read those from useContext(GlobalContext), not from here.
  return { pendingDetection, cancelDetection, confirmDetection };
}

// useShakeSOSTrigger — sibling to useAegisMonitoring(), deliberately NOT merged into it:
// a completely separate, independently-toggleable detector (userProfile.shakeSOSEnabled)
// so it works with or without a wearable connected, and touching it can't risk the
// already-working wearable pipeline. Its pending/cancel/confirm shape mirrors
// useAegisMonitoring()'s exactly so App.js's AegisMonitoringOverlay can feed both into
// the SAME single <AutoSOSCountdownModal> instance rather than showing two.
export function useShakeSOSTrigger() {
  const { userProfile, triggerSOS } = useContext(GlobalContext);
  const [pendingShake, setPendingShake] = useState(null);
  const monitorRef = useRef(null);
  const pendingShakeRef = useRef(null); // mirrors state for the async confirm handler below

  useEffect(() => {
    if (!userProfile.shakeSOSEnabled) return;

    const monitor = new ShakeGestureMonitor();
    monitorRef.current = monitor;
    monitor.start(() => {
      // No HR/motion data of its own — the shake gesture itself is the "detection".
      const detection = { timestamp: Date.now() };
      pendingShakeRef.current = detection;
      setPendingShake(detection);
    });

    return () => {
      monitor.stop();
      monitorRef.current = null;
    };
  }, [userProfile.shakeSOSEnabled]);

  const cancelShakeDetection = () => {
    monitorRef.current?.cooldown();
    pendingShakeRef.current = null;
    setPendingShake(null);
  };

  const confirmShakeDetection = async () => {
    const detection = pendingShakeRef.current;
    monitorRef.current?.cooldown();
    pendingShakeRef.current = null;
    setPendingShake(null);
    if (!detection) return false;
    const result = await triggerSOS(detection, 'auto_shake');
    return !!result;
  };

  return { pendingShake, cancelShakeDetection, confirmShakeDetection };
}
