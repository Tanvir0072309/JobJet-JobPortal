import { apiRequest } from "./api";

export type User = { id: string; email: string };
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
