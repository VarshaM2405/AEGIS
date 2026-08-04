import React, { createContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GlobalContext = createContext();

const DEFAULT_USER_PROFILE = {
  name: '',
  phone: '',
  profilePicture: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
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

  // The currently dispatched SOS record (null when no SOS is active), and any dispatch error
  const [activeSOS, setActiveSOS] = useState(null);
  const [sosError, setSosError] = useState(null);
  const [nearbySOS, setNearbySOS] = useState([]);

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

  const triggerSOS = async () => {
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
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
