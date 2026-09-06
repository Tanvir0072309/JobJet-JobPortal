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
// attachments) - stored the same way as the groq/hunter keys, encrypted.
export function saveSmtpCredential(smtpConfig: SmtpConfig) {
  return apiRequest("/api/settings/api-credentials", {
    method: "PUT",
    body: { provider: "smtp", smtpConfig },
  });
}

export function deleteApiCredential(provider: "groq" | "hunter" | "smtp") {
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
