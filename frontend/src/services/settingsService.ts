import { apiRequest } from "./api";

export function getApiCredentials() {
  return apiRequest<{ success: boolean; credentials: Record<string, any> }>(
    "/api/settings/api-credentials"
  );
}

export function saveApiCredential(provider: "groq" | "hunter", apiKey: string) {
  return apiRequest("/api/settings/api-credentials", {
    method: "PUT",
    body: { provider, apiKey },
  });
}

export function deleteApiCredential(provider: "groq" | "hunter") {
  return apiRequest(`/api/settings/api-credentials/${provider}`, { method: "DELETE" });
}

export function getApplicationSettings() {
  return apiRequest<{ success: boolean; settings: any }>("/api/settings/application");
}

export function updateApplicationSettings(payload: Record<string, any>) {
  return apiRequest<{ success: boolean; settings: any }>("/api/settings/application", {
    method: "PUT",
    body: payload,
  });
}

// Registers this device's Expo push token so the backend can notify the
// user when a company replies to one of their applications. Pass null to
// clear it (e.g. on logout, so a shared/reset device stops getting pings).
export function savePushToken(pushToken: string | null) {
  return apiRequest("/api/settings/push-token", {
    method: "PUT",
    body: { pushToken },
  });
}
