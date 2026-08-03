const BACKEND_PORT = 8000;

// Manual LAN IP of the machine running the backend. Update this if your
// laptop's IP changes (check with `ipconfig` on Windows / `ifconfig` on
// mac/Linux) - a phone on the same Wi-Fi network needs this to reach the
// backend; localhost only works for the emulator/simulator on the same machine.
const MANUAL_IP = 'YOUR_IPv4_ADDRESS';

export const API_BASE_URL = `http://${MANUAL_IP}:${BACKEND_PORT}`;
