// HeartRateMonitor — connects to the standard Bluetooth Heart Rate GATT
// profile (Service 0x180D / Measurement characteristic 0x2A37) that any
// generic HR strap or band advertises. This is exactly what LightBlue's
// "Heart Rate Monitor" virtual-device template emulates, so the whole
// pipeline is testable without real wearable hardware (see plan §7).
//
// A real Fitbit does NOT expose live sensors over generic BLE GATT to
// third-party apps — only generic straps/bands (Xiaomi, Polar, etc.) work
// with this as-is. Supporting a real Fitbit later means its cloud Web API
// (OAuth, polled, not real-time), a separate integration.
//
// Scanning and connecting are separate steps (startScan / connect) rather
// than one auto-connect-to-first-match call — WearableScreen shows every
// device startScan finds as a tappable list, so a stalled pairing is
// visibly "found nothing" vs. "found it, connect failed" instead of one
// opaque black box.
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

// Declaring BLUETOOTH_SCAN/CONNECT in app.json's manifest (done via the
// react-native-ble-plx config plugin) only makes Android *able* to ask —
// it doesn't ask. Runtime (dangerous) permissions need an explicit request
// or startDeviceScan below just fails silently with no system dialog ever
// shown, which is exactly what was happening before this existed.
async function ensureAndroidBlePermissions() {
  if (Platform.OS !== 'android') return true;

  // Android 12+ (API 31) split Bluetooth out from location into its own
  // BLUETOOTH_SCAN/BLUETOOTH_CONNECT permissions; anything older only
  // gates BLE scan results behind ACCESS_FINE_LOCATION.
  const permissions =
    Platform.Version >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  console.log('[BLE] permission results:', results);
  return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

// react-native-ble-plx hands characteristic values back as base64. RN has no
// built-in atob/Buffer, so decode by hand rather than pull in a dependency.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(base64) {
  const clean = base64.replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const val = BASE64_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

// Bluetooth GATT Heart Rate Measurement payload: flags byte + value.
// Flags bit 0: 0 = UINT8 bpm, 1 = UINT16 bpm (little-endian).
function decodeHeartRate(base64Value) {
  const bytes = base64ToBytes(base64Value);
  if (bytes.length < 2) return null;
  const flags = bytes[0];
  const is16Bit = (flags & 0x01) === 1;
  const bpm = is16Bit ? bytes[1] | (bytes[2] << 8) : bytes[1];
  return bpm;
}

export default class HeartRateMonitor {
  constructor() {
    this._manager = new BleManager();
    this._device = null;
    this._monitorSubscription = null;
    this._disconnectSubscription = null;
    this._livenessInterval = null;
    this._scanning = false;
    this._connecting = false;
  }

  // Scans for EVERY nearby BLE peripheral (no service filter) and reports each new one
  // via onDeviceFound — does NOT auto-connect. Keeps scanning until connect() or stop().
  //
  // Deliberately unfiltered rather than scanning for just HEART_RATE_SERVICE_UUID: an
  // advertisement packet is capped at 31 bytes, so plenty of peripherals (LightBlue's
  // virtual devices included, depending on how they're configured) don't put their full
  // service list in the ad packet itself — the real GATT service list only shows up
  // after connecting, via discoverAllServicesAndCharacteristics(). A service-UUID scan
  // filter is applied at the OS radio level and silently excludes anything that doesn't
  // advertise that UUID, which reads as "scanning forever, finds nothing" with zero
  // indication of why. Filtering here in JS instead (hasHeartRateService below) means we
  // still SEE the device and can try connecting to it regardless of what it advertised.
  // onDeviceFound: ({ id, name, rssi, hasHeartRateService }) => void, once per unique id
  // onStatus: (status: 'scanning'|'error', detail?) => void
  async startScan(onDeviceFound, onStatus = () => {}) {
    const permitted = await ensureAndroidBlePermissions();
    if (!permitted) {
      console.log('[BLE] permission denied, cannot scan');
      onStatus('error', 'Bluetooth permission denied');
      return;
    }

    const state = await this._manager.state();
    console.log('[BLE] adapter state:', state);
    if (state !== 'PoweredOn') {
      console.log('[BLE] adapter not powered on:', state);
      onStatus('error', 'Bluetooth is off');
      return;
    }

    const seen = new Set();
    console.log('[BLE] scanning for ALL nearby BLE devices (unfiltered, for diagnosis)');
    onStatus('scanning');
    this._scanning = true;
    this._manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('[BLE] scan error:', error.code, error.message, error.reason);
        this._scanning = false;
        onStatus('error', error.message);
        return;
      }
      if (!device || seen.has(device.id)) return;
      seen.add(device.id);
      const advertisedServices = device.serviceUUIDs || [];
      const hasHeartRateService = advertisedServices
        .map((u) => u.toLowerCase())
        .includes(HEART_RATE_SERVICE_UUID);
      console.log(
        `[BLE] found device: name="${device.name || '(unnamed)'}" id=${device.id} rssi=${device.rssi} ` +
        `advertisedServices=${JSON.stringify(advertisedServices)} hasHeartRateService=${hasHeartRateService}`
      );
      onDeviceFound({ id: device.id, name: device.name || device.id, rssi: device.rssi, hasHeartRateService });
    });
  }

  stopScan() {
    if (this._scanning) {
      console.log('[BLE] stopping scan');
      this._manager.stopDeviceScan();
      this._scanning = false;
    }
  }

  // Connects to one specific device (its id, as reported by startScan's onDeviceFound)
  // and starts streaming heart rate readings from it. Stops any in-progress scan first.
  // onReading: (bpm: number) => void
  // onStatus: (status: 'connecting'|'connected'|'disconnected'|'error', detail?) => void
  async connect(deviceId, onReading, onStatus = () => {}) {
    // Without this guard, two overlapping connect() calls to the same device (e.g. an
    // impatient double-tap on "Connect" before the first attempt has settled) race —
    // connectToDevice()'s second call interrupts the first mid-handshake, which fails
    // with "Operation was cancelled" / "Device was disconnected", then reconnects, then
    // gets interrupted again... an infinite loop, seen firsthand in testing (each cycle
    // also stacked up a new onDisconnected listener — see the fix for that further down).
    if (this._connecting) {
      console.log('[BLE] connect() ignored — a connection attempt is already in progress');
      return;
    }
    if (this._device?.id === deviceId) {
      console.log('[BLE] connect() ignored — already connected to this device');
      return;
    }
    if (this._device) {
      console.log('[BLE] switching devices — tearing down previous connection first');
      await this.stop();
    }

    this._connecting = true;
    this.stopScan();
    console.log('[BLE] connecting to', deviceId);
    onStatus('connecting');
    try {
      const device = await this._manager.connectToDevice(deviceId);
      console.log('[BLE] link established, discovering GATT services…');
      this._device = await device.discoverAllServicesAndCharacteristics();

      // Ground truth: what services this device ACTUALLY exposes post-connection,
      // independent of whatever (if anything) it put in its advertisement packet.
      const services = await this._device.services();
      const serviceUUIDs = services.map((s) => s.uuid.toLowerCase());
      console.log('[BLE] connected:', this._device.name || this._device.id, '— GATT services:', serviceUUIDs);

      if (!serviceUUIDs.includes(HEART_RATE_SERVICE_UUID)) {
        console.log(
          `[BLE] this device has no Heart Rate service (${HEART_RATE_SERVICE_UUID}). ` +
          `If this is LightBlue's virtual peripheral, check the "Heart Rate" service is ` +
          `actually added under its Virtual Peripheral config, not just the device name.`
        );
        onStatus('error', 'Connected, but this device has no Heart Rate service');
        return;
      }

      // Android's GATT stack is notoriously flaky about enabling notifications
      // (a CCCD descriptor write under the hood) immediately after service discovery
      // finishes — the connection hasn't always settled yet, and it can fail with a
      // generic "notify change failed" even though the characteristic and its Notify
      // property are genuinely there. A short pause + one retry clears this up on
      // affected stacks (seen on a OnePlus device) without changing anything peripheral-side.
      const subscribed = await this._subscribeToHeartRate(onReading, onStatus, 1);
      if (!subscribed) return; // already reported via onStatus('error', ...) inside the retry helper

      onStatus('connected', this._device.name || this._device.id);
      const connectedAt = Date.now();
      let alreadyHandled = false;

      const handleDisconnect = (source) => {
        if (alreadyHandled) return;
        alreadyHandled = true;
        console.log(
          `[BLE] disconnected (via ${source}) after ${((Date.now() - connectedAt) / 1000).toFixed(1)}s connected`
        );
        if (this._livenessInterval) {
          clearInterval(this._livenessInterval);
          this._livenessInterval = null;
        }
        this._device = null;
        onStatus('disconnected');
      };

      // Replacing (not just adding) the listener each connect — otherwise every
      // reconnect stacks another one on top of the last, and a single real disconnect
      // fires all of them at once (this is what "disconnected" logged N times, growing
      // by one each cycle, actually was).
      this._disconnectSubscription?.remove();
      this._disconnectSubscription = this._device.onDisconnected(() => handleDisconnect('onDisconnected event'));

      // Belt and suspenders: on some Android stacks (OnePlus's included, seen in
      // testing) the GATT link can die — usually under battery/idle power management —
      // WITHOUT ever firing onDisconnected. The app would otherwise sit there forever
      // still showing "Connected" with no data actually flowing. Poll the connection's
      // real state periodically and treat a "no" as a disconnect ourselves if the
      // native callback never tells us.
      const connectedDevice = this._device;
      this._livenessInterval = setInterval(async () => {
        try {
          const stillConnected = await connectedDevice.isConnected();
          if (!stillConnected) {
            console.log('[BLE] liveness check: device reports NOT connected, but no disconnect event fired');
            handleDisconnect('liveness check');
          }
        } catch (err) {
          console.log('[BLE] liveness check error (treating as disconnected):', err.message);
          handleDisconnect('liveness check error');
        }
      }, 15000);
    } catch (err) {
      console.log('[BLE] connect error:', err.message);
      onStatus('error', err.message);
    } finally {
      this._connecting = false;
    }
  }

  // Subscribes to the Heart Rate Measurement characteristic, retrying once if the
  // subscribe itself fails fast (within ~300ms) rather than after a real value/error
  // arrives later on — see the note in connect() above for why this retry exists.
  // Returns true once subscribed without an early error, false if both attempts failed.
  async _subscribeToHeartRate(onReading, onStatus, attempt) {
    // Give the just-completed service discovery a moment to settle before the
    // notify-enable write; longer pause on the retry.
    await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 400 : 900));

    console.log(`[BLE] subscribing to heart rate notifications (attempt ${attempt})`);
    let sawEarlyError = false;
    this._monitorSubscription = this._device.monitorCharacteristicForService(
      HEART_RATE_SERVICE_UUID,
      HEART_RATE_MEASUREMENT_UUID,
      (charError, characteristic) => {
        if (charError) {
          console.log(`[BLE] characteristic error (attempt ${attempt}):`, charError.message);
          sawEarlyError = true;
          onStatus('error', charError.message);
          return;
        }
        if (!characteristic?.value) return;
        const bpm = decodeHeartRate(characteristic.value);
        console.log('[BLE] heart rate reading:', bpm);
        if (bpm != null) onReading(bpm);
      }
    );

    // Fail-fast window: if an error callback already fired above, retry once with a
    // longer settle delay. If nothing's fired yet, treat the subscription as good —
    // a legitimate first reading may not arrive until the user pushes one from LightBlue.
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (sawEarlyError && attempt < 2) {
      console.log('[BLE] subscribe failed fast, retrying once…');
      this._monitorSubscription?.remove();
      this._monitorSubscription = null;
      return this._subscribeToHeartRate(onReading, onStatus, attempt + 1);
    }
    return !sawEarlyError;
  }

  async stop() {
    // If this logs right before a "disconnected"/"Operation was cancelled" error, our
    // own code tore the connection down on purpose — check the call site (either the
    // effect cleanup log in GlobalContext.js, or "switching devices" just above in
    // connect()). If neither of those logged first, the disconnect wasn't us at all —
    // it came from the device/OS itself.
    if (this._device) console.log('[BLE] stop() called — cancelling active connection');
    this.stopScan();
    if (this._livenessInterval) {
      clearInterval(this._livenessInterval);
      this._livenessInterval = null;
    }
    this._disconnectSubscription?.remove();
    this._disconnectSubscription = null;
    this._monitorSubscription?.remove();
    this._monitorSubscription = null;
    if (this._device) {
      try {
        await this._device.cancelConnection();
      } catch {
        // already disconnected — nothing to do
      }
      this._device = null;
    }
  }

  destroy() {
    this._manager.destroy();
  }
}
