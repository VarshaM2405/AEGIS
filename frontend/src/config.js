import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 8000;

// Expo Go / dev builds already know the LAN IP of the machine running Metro,
// because the phone used it to load this JS bundle. The backend runs on the
// same machine (see README), so we can reuse that IP as a fallback when no
// explicit host/URL is configured.
const resolveApiHost = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${BACKEND_PORT}`;
  }

  // Optional escape hatch (e.g. backend running on a different machine than
  // Metro, or an emulator setup) via an EXPO_PUBLIC_API_HOST env var / .env entry.
  if (process.env.EXPO_PUBLIC_API_HOST) {
    return `http://${process.env.EXPO_PUBLIC_API_HOST}:${BACKEND_PORT}`;
  }

  const explicitBaseUrl = Constants?.expoConfig?.extra?.apiBaseUrl || Constants?.manifest?.extra?.apiBaseUrl;
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const explicitHost = Constants?.expoConfig?.extra?.apiHost || Constants?.manifest?.extra?.apiHost;
  const explicitPort = Constants?.expoConfig?.extra?.apiPort || Constants?.manifest?.extra?.apiPort || BACKEND_PORT;
  if (explicitHost) {
    return `http://${explicitHost}:${explicitPort}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest?.hostUri ||
    Constants.manifest?.packagerOpts?.hostUri ||
    Constants.manifest2?.debuggerHost ||
    Constants.manifest2?.hostUri ||
    Constants.manifest2?.packagerOpts?.hostUri ||
    Constants.expoGo?.hostUri ||
    Constants.expoGo?.debuggerHost ||
    Constants.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    const resolvedHost = host === '127.0.0.1' || host === 'localhost'
      ? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')
      : host;
    return `http://${resolvedHost}:${explicitPort}`;
  }

  return `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${explicitPort}`;
};

export const API_BASE_URL = resolveApiHost();
