import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { apiRequest } from "./api";

export type GmailStatus = { success: boolean; connected: boolean; email: string | null };

export function getGmailStatus() {
  return apiRequest<GmailStatus>("/api/gmail/status");
}

export function disconnectGmail() {
  return apiRequest<{ success: boolean; message: string }>("/api/gmail/disconnect", { method: "POST" });
}

export type ConnectGmailResult = { status: "success" | "error" | "cancelled" };

// Runs the full connect-Gmail flow: asks the backend for a Google consent
// URL (built server-side from GOOGLE_CLIENT_ID - no secret ever touches this
// device), opens it in an in-app browser (system Custom Tabs on Android, so
// this satisfies Google's policy against embedded WebViews for OAuth), and
// waits for the backend's OAuth callback to redirect back into the app via
// the existing "jobjet://" scheme (see GMAIL_OAUTH_APP_REDIRECT on the
// backend). The actual tokens never pass through this device at all - they
// go straight from Google to the backend in the server-side callback.
export async function connectGmail(): Promise<ConnectGmailResult> {
  const { authUrl } = await apiRequest<{ success: boolean; authUrl: string }>("/api/gmail/oauth/start", {
    method: "POST",
  });

  // Must match the scheme registered in app.json ("jobjet") - the backend
  // redirects here once the OAuth callback finishes, with a `status` query
  // param telling us how it went.
  const returnUrl = Linking.createURL("gmail-callback");

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

  if (result.type === "cancel" || result.type === "dismiss") {
    return { status: "cancelled" };
  }

  if (result.type === "success" && result.url) {
    const { queryParams } = Linking.parse(result.url);
    if (queryParams?.status === "success") return { status: "success" };
    return { status: "error" };
  }

  return { status: "error" };
}
