import { API_BASE_URL } from "../constants/config";

// Token lives only in memory for the lifetime of the JS process, by design:
// the product spec explicitly forbids "remember me" / persistent auto-login.
// Closing/reloading the app requires logging in again.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  isFormData?: boolean;
};

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, isFormData = false } = options;

  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the JobJet server. Is the backend running and is EXPO_PUBLIC_API_URL correct?",
      0,
      "NETWORK_ERROR"
    );
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (e.g. 204); fine to leave data null.
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || `Request failed with status ${response.status}`,
      response.status,
      data?.code
    );
  }

  return data as T;
}
