import { Platform } from "react-native";

function defaultApiUrl(): string {
  // 1. Pehle `.env` file se EXPO_PUBLIC_API_URL read karega
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Agar .env nahi milega toh Local Testing ke liye fallback karega
  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  return "http://localhost:5000";
}

export const API_BASE_URL = defaultApiUrl();