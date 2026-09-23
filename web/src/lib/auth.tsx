import React, { createContext, useContext, useEffect, useState } from "react";
import { api, isSignedIn, onSessionChange, setSession } from "./api";
import type { AuthResponse } from "./types";

interface AuthState {
  signedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState(isSignedIn());
  useEffect(() => {
    const unsubscribe = onSessionChange(() => setSignedIn(isSignedIn()));
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/v1/auth/login", { email, password });
    setSession(res.tokens);
  };
  const logout = () => setSession(null);

  return <AuthContext.Provider value={{ signedIn, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
