import { Platform } from "react-native";

// Override with EXPO_PUBLIC_API_URL in a .env file at the frontend root when
// testing on a physical device (use your machine's LAN IP, e.g. http://192.168.1.20:5000).
function defaultApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Android emulator can't reach "localhost" (that's the emulator itself).
  if (Platform.OS === "android") return "http://10.0.2.2:5000";
  return "http://localhost:5000";
}

export const API_BASE_URL = defaultApiUrl();
