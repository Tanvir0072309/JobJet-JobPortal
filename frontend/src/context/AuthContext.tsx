import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { setAuthToken, setUnauthorizedHandler } from "../services/api";
import * as authService from "../services/authService";
import { registerForPushNotificationsAsync } from "../services/notificationsService";
import { savePushToken } from "../services/settingsService";
import { clearScreenCache } from "../utils/screenCache";
import type { User } from "../services/authService";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Session is persisted in the device's secure storage (Keychain on iOS,
// Keystore-backed EncryptedSharedPreferences on Android) so closing/
// reopening the app doesn't force a fresh login every time. The JWT itself
// still expires server-side after JWT_EXPIRES_IN (see backend/.env) - if a
// stored token has expired, the first authenticated API call will 401 and
// we clear the stored session then (see setUnauthorizedHandler below).
const TOKEN_KEY = "jobjet.auth.token";
const USER_KEY = "jobjet.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    // Runs once on app launch: try to restore a previously saved session
    // before rendering any auth-gated screen.
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setAuthToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Corrupt/inaccessible storage - just fall back to a logged-out state.
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    // If any API call ever comes back 401 (expired/invalid token), drop the
    // session everywhere rather than leaving the user stuck on screens that
    // silently fail.
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setUser(null);
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    // Register this device for "a company replied" push notifications as
    // soon as we have an authenticated session - covers both a fresh
    // login/register and a session restored from SecureStore on app
    // launch. Best-effort: a denied permission or a missing physical
    // device (simulators can't get push tokens) just means no push token
    // gets sent, the rest of the app still works normally.
    if (!user) return;
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushToken(token);
        }
      } catch {
        // Non-critical - silently skip push registration on any failure.
      }
    })();
  }, [user]);

  const persistSession = async (token: string, sessionUser: User) => {
    setAuthToken(token);
    setUser(sessionUser);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(sessionUser)),
    ]);
  };

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    await persistSession(res.token, res.user);
  };

  const register = async (email: string, password: string) => {
    const res = await authService.register(email, password);
    await persistSession(res.token, res.user);
  };

  const logout = async () => {
    try {
      await savePushToken(null);
    } catch {
      // Non-critical - proceed with logout even if this fails.
    }
    try {
      await authService.logout();
    } catch {
      // Even if the network call fails, clear local session state.
    }
    setAuthToken(null);
    setUser(null);
    clearScreenCache();
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(USER_KEY).catch(() => {}),
    ]);
  };

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isBootstrapping, login, register, logout }),
    [user, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
