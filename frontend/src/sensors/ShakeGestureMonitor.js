// ShakeGestureMonitor — detects a deliberate multi-shake gesture, distinct from
// MotionMonitor+DetectionEngine's passive fall/stillness detection. Wraps the same
// Accelerometer (expo-sensors) but counts qualifying magnitude peaks: a SINGLE spike
// must NOT fire this (that's the wearable pipeline's fall-detector job — see
// DetectionEngine.js's FALL_SPIKE_THRESHOLD); only several deliberate shakes in quick
// succession count as the gesture itself being the "confirmation" (unlike ambient HR/
// motion data, no separate multi-second confirm window is needed here).
//
// Thresholds below are starting guesses pending real-device tuning, exactly like
// DetectionEngine.js's documented-as-guesses HR/stillness thresholds.
import { Accelerometer } from 'expo-sensors';

const UPDATE_INTERVAL_MS = 100; // faster than MotionMonitor's 500ms — shakes are quick
export const SHAKE_MAGNITUDE_THRESHOLD = 3.2; // higher than DetectionEngine's FALL_SPIKE_THRESHOLD (2.5)
export const REFRACTORY_MS = 200; // min gap between counted peaks — one swing isn't double-counted
export const REQUIRED_PEAKS = 4; // qualifying peaks needed...
export const WINDOW_MS = 1500; // ...within this many milliseconds
const DEFAULT_COOLDOWN_MS = 60000; // mirrors DetectionEngine's COOLDOWN_MS

function magnitudeOf({ x, y, z }) {
  return Math.sqrt(x * x + y * y + z * z);
}

export default class ShakeGestureMonitor {
  constructor() {
    this._subscription = null;
    this._peakTimestamps = [];
    this._lastPeakAt = 0;
    this._cooldownUntil = 0;
  }

  // onShakeDetected: () => void — fires once when REQUIRED_PEAKS qualifying peaks land
  // within WINDOW_MS of each other, then resets its own peak count (caller decides what
  // happens next via the shared AutoSOSCountdownModal flow, not this class).
  start(onShakeDetected) {
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    this._subscription = Accelerometer.addListener((data) => {
      const now = Date.now();
      if (now < this._cooldownUntil) return;

      const magnitude = magnitudeOf(data);
      if (magnitude < SHAKE_MAGNITUDE_THRESHOLD) return;
      if (now - this._lastPeakAt < REFRACTORY_MS) return; // same swing, don't double-count

      this._lastPeakAt = now;
      this._peakTimestamps.push(now);
      this._peakTimestamps = this._peakTimestamps.filter((t) => now - t <= WINDOW_MS);

      if (this._peakTimestamps.length >= REQUIRED_PEAKS) {
        this._peakTimestamps = [];
        onShakeDetected();
      }
    });
  }

  // Arms a cooldown so continued vigorous motion (or just setting the phone down hard)
  // doesn't immediately re-trigger right after a cancel — mirrors DetectionEngine.cancel()
  // /reset()'s cooldown for the identical reason.
  cooldown(ms = DEFAULT_COOLDOWN_MS) {
    this._cooldownUntil = Date.now() + ms;
    this._peakTimestamps = [];
  }

  stop() {
    this._subscription?.remove();
    this._subscription = null;
    this._peakTimestamps = [];
  }
}
