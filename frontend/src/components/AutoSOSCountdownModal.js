// AutoSOSCountdownModal — the cancel/countdown window between the detection
// engine recognizing a distress pattern and an SOS actually being sent, plus
// a visible confirmation afterward.
// Rendered as a root-level overlay in App.js (a conditional <Modal
// transparent>) so it works from anywhere in the app without navigation-ref
// plumbing, mirroring the in-screen modal pattern already used for
// `selectedSOS` in HomeScreen.js.
//
// Real distress detectors — Apple Watch fall detection included — always
// give the user a chance to cancel before anyone else is notified. Detection
// triggers a vibrate + ten-second countdown, cancellable; only on timeout
// does it actually send.
//
// `phase` decouples the modal's own visibility from the `visible` prop
// (which tracks GlobalContext's pendingDetection, cleared the instant the
// countdown hits zero) — without this, the modal would just vanish the
// moment sending started, leaving no on-screen confirmation of what
// happened. Instead this component owns `open` itself and only closes it
// after showing a Sent/Failed result.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Vibration } from 'react-native';

const COUNTDOWN_SECONDS = 10;
const RESULT_AUTODISMISS_MS = 5000;

export default function AutoSOSCountdownModal({ visible, onCancel, onTimeout }) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [phase, setPhase] = useState('countdown'); // 'countdown' | 'sending' | 'sent' | 'failed'
  const [open, setOpen] = useState(false);
  const intervalRef = useRef(null);
  const dismissTimerRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    setOpen(true);
    setPhase('countdown');
    setSecondsLeft(COUNTDOWN_SECONDS);
    Vibration.vibrate([500, 500], true); // repeating pattern for urgency

    intervalRef.current = setInterval(() => {
      // Just count down here — no side effects. Calling onTimeout() (which reaches into
      // GlobalContext/AegisMonitoringOverlay's state) from inside this updater function
      // fires it DURING this component's own render/state-update cycle, which React
      // (Fabric especially) disallows: "Cannot update a component while rendering a
      // different component." It doesn't just warn — it can silently drop the update.
      // The effect below fires onTimeout instead, safely outside of any render, once
      // secondsLeft actually reaches 0.
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      Vibration.cancel();
    };
  }, [visible]);

  // Fires once the countdown actually reaches 0: sends, then shows the result.
  useEffect(() => {
    if (!visible || phase !== 'countdown' || secondsLeft > 0) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    Vibration.cancel();
    setPhase('sending');
    (async () => {
      const success = await onTimeout();
      setPhase(success ? 'sent' : 'failed');
      dismissTimerRef.current = setTimeout(() => setOpen(false), RESULT_AUTODISMISS_MS);
    })();
  }, [visible, phase, secondsLeft]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    Vibration.cancel();
    setOpen(false);
    onCancel();
  };

  const handleDismissResult = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setOpen(false);
  };

  return (
    <Modal visible={open} animationType="fade" transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 30, padding: 28, borderWidth: 3, borderColor: '#FF1744', alignItems: 'center' }}>
          {(phase === 'countdown' || phase === 'sending') && (
            <>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#D81B60', marginBottom: 8, textAlign: 'center' }}>
                Distress detected
              </Text>
              {phase === 'countdown' ? (
                <>
                  <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 20, textAlign: 'center' }}>
                    Sending SOS in {secondsLeft}s unless you cancel
                  </Text>
                  <Text style={{ fontSize: 56, fontWeight: '900', color: '#FF1744', marginBottom: 24 }}>
                    {secondsLeft}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCancel}
                    style={{ backgroundColor: '#4A2E35', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>I'm okay — Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: '#4A2E35', fontSize: 15, marginTop: 8, textAlign: 'center' }}>
                  Sending SOS…
                </Text>
              )}
            </>
          )}

          {phase === 'sent' && (
            <>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>✅</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#34C759', marginBottom: 8, textAlign: 'center' }}>
                SOS Sent
              </Text>
              <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 20, textAlign: 'center' }}>
                Your location and details were sent. Help is on the way.
              </Text>
              <TouchableOpacity
                onPress={handleDismissResult}
                style={{ backgroundColor: '#4A2E35', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>Okay</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'failed' && (
            <>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>⚠️</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FF1744', marginBottom: 8, textAlign: 'center' }}>
                Could not send SOS
              </Text>
              <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 20, textAlign: 'center' }}>
                Check your connection — the server may be unreachable.
              </Text>
              <TouchableOpacity
                onPress={handleDismissResult}
                style={{ backgroundColor: '#4A2E35', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>Okay</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
