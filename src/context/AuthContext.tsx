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
  signup: (payload: {
    fullName: string;
    email: string;
    password?: string;
    companyDomain: string;
    companyName: string;
    jobTitle?: string;
    phone?: string;
    prospectingGoal?: string;
  }) => Promise<{
    success: boolean;
    pendingApproval?: boolean;
    message?: string;
    error?: string;
    redirectUrl?: string;
  }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
          if (json.user.role === "admin") {
            setOperatingRoleState("admin");
          } else if (
            json.user.role === "humagent" ||
            json.user.role === "researcher"
          ) {
            setOperatingRoleState("human_agent");
          } else {
            setOperatingRoleState("client");
          }
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
      if (data.user?.role === "admin") {
        setOperatingRoleState("admin");
      } else if (data.user?.role === "humagent") {
        setOperatingRoleState("human_agent");
      } else {
        setOperatingRoleState("client");
      }
      setIsAuthModalOpen(false);
      await syncWorkflowFromDatabase();
      return { success: true, redirectUrl: data.redirectUrl };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  };

  const signup = async (payload: {
    fullName: string;
    email: string;
    password?: string;
    companyDomain: string;
    companyName: string;
    jobTitle?: string;
    phone?: string;
    prospectingGoal?: string;
  }) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || data.message || "Request submission failed",
        };
      }

      return {
        success: true,
        pendingApproval: true,
        message:
          data.message ||
          "Your request has been sent to the Admin. Once approved, your generated Login ID & Password will be sent to your email.",
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
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
