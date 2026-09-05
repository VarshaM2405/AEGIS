// MotionMonitor — wraps the phone's accelerometer (expo-sensors) into a small
// rolling-window stream of { magnitude, variance } samples that DetectionEngine
// consumes. "Motion" here is the *phone's* accelerometer, not the wearable's —
// band accelerometer data is vendor-proprietary and isn't on the standard BLE
// GATT service used for heart rate (see HeartRateMonitor.js).
import { Accelerometer } from 'expo-sensors';

const UPDATE_INTERVAL_MS = 500;
const WINDOW_SIZE = 20; // 20 samples @ 500ms = last ~10s of motion

function magnitudeOf({ x, y, z }) {
  return Math.sqrt(x * x + y * y + z * z);
}

function varianceOf(samples) {
  if (samples.length === 0) return 0;
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const sqDiffSum = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return sqDiffSum / samples.length;
}

export default class MotionMonitor {
  constructor() {
    this._window = [];
    this._subscription = null;
    this._lastMagnitude = 1; // resting accel reads ~1g
  }

  // onSample: ({ magnitude, variance, timestamp }) => void
  start(onSample) {
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    this._subscription = Accelerometer.addListener((data) => {
      const magnitude = magnitudeOf(data);
      this._lastMagnitude = magnitude;
      this._window.push(magnitude);
      if (this._window.length > WINDOW_SIZE) this._window.shift();

      onSample({
        magnitude,
        variance: varianceOf(this._window),
        timestamp: Date.now(),
      });
    });
  }

  stop() {
    this._subscription?.remove();
    this._subscription = null;
    this._window = [];
  }
}
