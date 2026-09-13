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

// Danger zone: clears the inbox (every email thread) only.
export function eraseEmails() {
  return apiRequest<{ success: boolean; message: string }>("/api/settings/erase-emails", {
    method: "DELETE",
  });
}

// Danger zone: clears companies, applications, emails, and documents.
export function eraseAllData() {
  return apiRequest<{ success: boolean; message: string }>("/api/settings/erase-all-data", {
    method: "DELETE",
  });
}

// Danger zone: permanently deletes the user's row from the database (and
// everything that cascades from it - login, companies, applications,
// emails, documents, saved API keys, Gmail connection). Unlike
// eraseAllData, the account itself is gone after this - the caller should
// log the user out and send them to the login screen right after.
export function deleteAccount() {
  return apiRequest<{ success: boolean; message: string }>("/api/settings/delete-account", {
    method: "DELETE",
  });
}
