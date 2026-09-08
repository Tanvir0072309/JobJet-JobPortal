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

// Tomba (the email-finder, replacing Hunter) authenticates with a key +
// secret pair rather than a single API key.
export function saveTombaCredential(tombaKey: string, tombaSecret: string) {
  return apiRequest("/api/settings/api-credentials", {
    method: "PUT",
    body: { provider: "tomba", tombaKey, tombaSecret },
  });
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
  fromName?: string;
  imapHost?: string;
  imapPort?: number;
};

// The sending email account (used to actually deliver applications, with
// attachments) - stored the same way as the groq/tomba keys, encrypted.
export function saveSmtpCredential(smtpConfig: SmtpConfig) {
  return apiRequest("/api/settings/api-credentials", {
    method: "PUT",
    body: { provider: "smtp", smtpConfig },
  });
}

export function deleteApiCredential(provider: "groq" | "tomba" | "hunter" | "smtp") {
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
