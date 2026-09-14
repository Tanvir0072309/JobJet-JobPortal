import { apiRequest } from "./api";

// gmailConnected/gmailEmail aren't returned by /api/auth/register or
// /api/auth/login (those endpoints don't touch Gmail at all) - they're
// filled in right after, from GET /api/gmail/status, in AuthContext. See
// AuthContext.refreshGmailStatus.
// avatarUrl (the candidate's uploaded profile picture, relative path like
// gmailEmail/gmailConnected) isn't returned here either - it lives on the
// profiles table and is pulled in + kept in sync by AuthContext.refreshAvatar,
// so the top bar can show it as soon as it's known instead of only after a
// full profile-screen visit.
export type User = {
  id: string;
  email: string;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
  avatarUrl?: string | null;
};
export type AuthResponse = { success: boolean; token: string; user: User };

export function register(email: string, password: string) {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function logout() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export function forgotPassword(email: string) {
  return apiRequest<{ success: boolean; message: string; devResetToken?: string }>(
    "/api/auth/forgot-password",
    { method: "POST", body: { email } }
  );
}

export function resetPassword(token: string, newPassword: string) {
  return apiRequest<{ success: boolean; message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });
}
