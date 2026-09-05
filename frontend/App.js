import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalProvider, useAegisMonitoring, useShakeSOSTrigger } from './src/contexts/GlobalContext';
import AppNavigator from './src/navigation/AppNavigator';
import AutoSOSCountdownModal from './src/components/AutoSOSCountdownModal';
import { useFonts, Cinzel_400Regular, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';

// Root-level overlay: watches the wearable (when enabled) and shows the
// vibrate + ten-second cancel/countdown window before an auto-detected SOS
// actually sends. Lives inside GlobalProvider (needs its context) and outside
// AppNavigator (doesn't need navigation) so it works from any screen.
function AegisMonitoringOverlay() {
  // Diagnostic only: a useRef's initializer runs exactly once per component INSTANCE —
  // if this same random id keeps appearing in the logs, it's one instance re-rendering
  // (harmless). If a NEW id appears each time the BLE pipeline restarts, this component
  // is being torn down and remounted from scratch by something above it (React root,
  // Fast Refresh doing a full-reload instead of a hot patch, etc.) — not a BLE issue at all.
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));
  console.log('[BLE] AegisMonitoringOverlay render, instance=', instanceId.current);

  const { pendingDetection, cancelDetection, confirmDetection } = useAegisMonitoring();
  // Independent shake-gesture trigger (see useShakeSOSTrigger in GlobalContext.js) fed
  // into this SAME modal instance rather than a second one — if both somehow fire at
  // once, the wearable detection takes precedence (rare edge case, not a shared cooldown).
  const { pendingShake, cancelShakeDetection, confirmShakeDetection } = useShakeSOSTrigger();

  const visible = !!pendingDetection || !!pendingShake;
  const onCancel = pendingDetection ? cancelDetection : cancelShakeDetection;
  const onTimeout = pendingDetection ? confirmDetection : confirmShakeDetection;

  return (
    <AutoSOSCountdownModal
      visible={visible}
      onCancel={onCancel}
      onTimeout={onTimeout}
    />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_700Bold,
    Outfit_400Regular,
    Outfit_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider style={styles.container}>
      <GlobalProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
        <AegisMonitoringOverlay />
      </GlobalProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
