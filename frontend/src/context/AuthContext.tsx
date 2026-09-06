import React, { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { setAuthToken } from "../services/api";
import * as authService from "../services/authService";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // No token restoration from storage happens here on purpose - every fresh
  // app launch starts logged out, matching the "no persistent login" requirement.
  const [isBootstrapping] = useState(false);

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    setAuthToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string) => {
    const res = await authService.register(email, password);
    setAuthToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Even if the network call fails, clear local session state.
    }
    setAuthToken(null);
    setUser(null);
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
