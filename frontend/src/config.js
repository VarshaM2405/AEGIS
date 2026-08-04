const BACKEND_PORT = 8000;

// Manual LAN IP of the machine running the backend. Update this if your
// laptop's IP changes (check with `ipconfig` on Windows / `ifconfig` on
// mac/Linux) - a phone on the same Wi-Fi network needs this to reach the
// backend; localhost only works for the emulator/simulator on the same machine.
// Updated to the current detected IPv4 address on this machine.
const MANUAL_IP = '172.20.10.2';

export const API_BASE_URL = `http://${MANUAL_IP}:${BACKEND_PORT}`;
export const EXPO_DEV_URL = `exp://${MANUAL_IP}:8081`;