// DetectionEngine — fuses the latest heart-rate + motion readings into a
// distress judgment. It never sends an SOS itself: once a condition holds
// for CONFIRM_WINDOW_MS it calls onDangerDetected(...) and hands the
// countdown / cancel / send decision to the caller (AutoSOSCountdownModal,
// wired up in GlobalContext's useAegisMonitoring()).
//
// Thresholds below are starting guesses, not tuned values — LightBlue proves
// the pipeline, not threshold accuracy. Real tuning needs a real device.
export const HR_THRESHOLD = 130; // bpm counted as elevated
export const STILLNESS_VARIANCE = 0.02; // motion variance counted as "not moving"
export const CONFIRM_WINDOW_MS = 8000; // sustained condition before it counts as detected
export const FALL_SPIKE_THRESHOLD = 2.5; // sudden accel magnitude read as a fall
export const COOLDOWN_MS = 60000; // suppress re-detection for 60s after a user cancel

// confidence is a documented heuristic, not a model — a real anomaly
// detector is a clear later phase, not built now.
function computeConfidence({ highHR, isStill, fallSpike, heartRate }) {
  let score = 0.5;
  if (highHR) score += 0.2;
  if (isStill) score += 0.15;
  if (fallSpike) score += 0.25;
  if (heartRate && heartRate > HR_THRESHOLD + 20) score += 0.1;
  return Math.min(score, 0.98);
}

export default class DetectionEngine {
  constructor(onDangerDetected) {
    this._onDangerDetected = onDangerDetected;
    this._heartRate = null;
    this._motion = null; // { magnitude, variance }
    this._conditionSince = null;
    this._snoozeUntil = 0;
    this._fired = false;
  }

  updateHeartRate(bpm) {
    this._heartRate = bpm;
    this.evaluate();
  }

  updateMotion(sample) {
    this._motion = sample;
    this.evaluate();
  }

  // Called by the caller once the user cancels a countdown — arms the
  // cooldown guard so the still-true condition doesn't immediately re-fire
  // (a cancel-during-exercise loop).
  cancel() {
    this._snoozeUntil = Date.now() + COOLDOWN_MS;
    this._conditionSince = null;
    this._fired = false;
  }

  // Called once the caller has actually sent the SOS (countdown reached zero). Arms the
  // same cooldown as cancel() — without it, a still-true condition (LightBlue still
  // reporting high BPM, phone still motionless) just starts a fresh 8s-confirm + 10s-
  // countdown cycle immediately, re-sending a brand new SOS every ~18-20s indefinitely.
  // That's not a hypothetical: it's exactly what happened during testing before this
  // cooldown was added here — four separate SOS events, ~20s apart, same reading.
  reset() {
    this._snoozeUntil = Date.now() + COOLDOWN_MS;
    this._conditionSince = null;
    this._fired = false;
  }

  evaluate() {
    const now = Date.now();
    if (now < this._snoozeUntil) return;
    if (this._fired) return;

    const highHR = this._heartRate != null && this._heartRate > HR_THRESHOLD;
    const isStill = this._motion != null && this._motion.variance < STILLNESS_VARIANCE;
    const fallSpike = this._motion != null && this._motion.magnitude > FALL_SPIKE_THRESHOLD;

    const conditionHolds = fallSpike || (highHR && isStill);

    if (!conditionHolds) {
      this._conditionSince = null;
      return;
    }

    if (this._conditionSince == null) {
      this._conditionSince = now;
      return;
    }

    if (now - this._conditionSince >= CONFIRM_WINDOW_MS) {
      this._fired = true;
      const confidence = computeConfidence({
        highHR,
        isStill,
        fallSpike,
        heartRate: this._heartRate,
      });
      this._onDangerDetected({
        reason: fallSpike ? 'fall' : 'elevated_hr_stillness',
        heartRate: this._heartRate,
        motionScore: this._motion?.variance ?? null,
        confidence,
        timestamp: now,
      });
    }
  }
}
