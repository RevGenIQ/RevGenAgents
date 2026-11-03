"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { OperatingRole } from "@/lib/supabase/types";
import { syncWorkflowFromDatabase } from "@/lib/store/osWorkflowStore";

export interface UserProfile {
  userId: string;
  email: string;
  role: "admin" | "client" | "humagent" | "member" | "researcher";
  operatingRole?: OperatingRole;
  workspaceId: string;
  companyDomain?: string;
  companyName?: string;
  fullName?: string;
  loginId?: string;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
  companyDomain?: string;
  jobTitle?: string;
  phone?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  operatingRole: OperatingRole;
  setOperatingRole: (role: OperatingRole) => void;
  isAuthModalOpen: boolean;
  authModalMode: "signin" | "signup";
  openAuthModal: (mode?: "signin" | "signup") => void;
  closeAuthModal: () => void;
  login: (
    identifier: string,
    password: string,
    companyDomain?: string
  ) => Promise<{ success: boolean; error?: string; redirectUrl?: string }>;
  signup: (payload: SignupPayload) => Promise<{
    success: boolean;
    error?: string;
    redirectUrl?: string;
  }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mirrors the server's scoping: only admin and humagent sessions get staff views.
function toOperatingRole(role: string | undefined): OperatingRole {
  if (role === "admin") return "admin";
  if (role === "humagent") return "human_agent";
  return "client";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [operatingRole, setOperatingRoleState] =
    useState<OperatingRole>("client");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">(
    "signin"
  );

  // Role is strictly derived from authenticated user session
  const setOperatingRole = (_role: OperatingRole) => {
    // Role switching via UI toggles is disabled; role is strictly governed by authentication
  };

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        if (json.authenticated && json.user) {
          setUser(json.user);
          setOperatingRoleState(toOperatingRole(json.user.role));
          await syncWorkflowFromDatabase();
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const openAuthModal = (mode: "signin" | "signup" = "signin") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const login = async (
    identifier: string,
    password: string,
    companyDomain?: string
  ) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier,
          email: identifier,
          password,
          companyDomain,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || data.message || "Login failed",
        };
      }

      setUser(data.user);
      setOperatingRoleState(toOperatingRole(data.user?.role));
      setIsAuthModalOpen(false);
      await syncWorkflowFromDatabase();
      return { success: true, redirectUrl: data.redirectUrl };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  };

  const signup = async (payload: SignupPayload) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || data.message || "Registration failed" };
      }
      // The server set the session cookie: the client is signed in straight away.
      setUser(data.user);
      setOperatingRoleState(toOperatingRole(data.user?.role));
      setIsAuthModalOpen(false);
      await syncWorkflowFromDatabase();
      return { success: true, redirectUrl: data.redirectUrl };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      window.location.href = "/";
    } catch {
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        operatingRole,
        setOperatingRole,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        login,
        signup,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
