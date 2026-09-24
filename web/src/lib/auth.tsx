import React, { createContext, useContext, useEffect, useState } from "react";
import { api, currentRole, isSignedIn, onSessionChange, setSession } from "./api";
import type { AuthResponse } from "./types";

export interface RegisterInput {
  email: string; password: string; firstName: string; lastName: string; phone: string; dateOfBirth: string;
}
interface AuthState {
  signedIn: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [role, setRole] = useState(currentRole());
  useEffect(() => {
    const unsubscribe = onSessionChange(() => { setSignedIn(isSignedIn()); setRole(currentRole()); });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/v1/auth/login", { email, password });
    setSession(res.tokens);
  };
  const register = async (input: RegisterInput) => {
    const res = await api.post<AuthResponse>("/v1/auth/register", input);
    setSession(res.tokens);
  };
  const logout = () => setSession(null);

  const isStaff = role === "staff" || role === "admin";
  return <AuthContext.Provider value={{ signedIn, isStaff, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
