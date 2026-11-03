"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export type AuthMode = "signin" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Called after a successful sign-in or registration with the server's redirect. */
  onSuccess: (redirectUrl: string) => void;
  tone?: "dark" | "light";
}

const MIN_PASSWORD = 12;

const TONES = {
  dark: {
    label: "text-slate-300",
    input:
      "bg-[#111a2e] border-slate-700 text-white placeholder-slate-500 focus:border-indigo-400 focus:ring-indigo-400/25",
    hint: "text-slate-400",
    tabs: "bg-[#111a2e] border-slate-700",
    tabIdle: "text-slate-400 hover:text-white",
    link: "text-indigo-300 hover:text-indigo-200",
  },
  light: {
    label: "text-slate-600",
    input:
      "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20",
    hint: "text-slate-500",
    tabs: "bg-slate-100 border-slate-200",
    tabIdle: "text-slate-500 hover:text-slate-900",
    link: "text-indigo-600 hover:text-indigo-700",
  },
} as const;

/** Sign-in and self-serve registration form shared by the auth page and the modal. */
export function AuthForm({ mode, onModeChange, onSuccess, tone = "dark" }: AuthFormProps) {
  const { login, signup } = useAuth();
  const t = TONES[tone];

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: AuthMode) => {
    setError(null);
    onModeChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === "signin"
          ? await login(identifier.trim(), password)
          : await signup({
              fullName: fullName.trim(),
              email: email.trim(),
              password,
              companyName: companyName.trim(),
              jobTitle: jobTitle.trim(),
            });
      if (!res.success) setError(res.error || "Something went wrong. Please try again.");
      else onSuccess(res.redirectUrl || "/");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-colors ${t.input}`;
  const labelClass = `block text-xs font-medium mb-1.5 ${t.label}`;

  return (
    <div>
      <div role="tablist" className={`grid grid-cols-2 gap-1 p-1 rounded-lg border mb-6 ${t.tabs}`}>
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`py-2 text-sm font-medium rounded-md transition-colors ${
              mode === m ? "bg-indigo-600 text-white" : t.tabIdle
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === "signin" ? (
          <div>
            <label htmlFor="auth-identifier" className={labelClass}>Work email or login ID</label>
            <input
              id="auth-identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="auth-name" className={labelClass}>Full name</label>
                <input id="auth-name" type="text" autoComplete="name" required value={fullName}
                  onChange={(e) => setFullName(e.target.value)} placeholder="Priya Sharma" className={inputClass} />
              </div>
              <div>
                <label htmlFor="auth-title" className={labelClass}>Job title</label>
                <input id="auth-title" type="text" autoComplete="organization-title" value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)} placeholder="Head of Sales" className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="auth-email" className={labelClass}>Work email</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} />
              <p className={`text-xs mt-1.5 ${t.hint}`}>Company email only. Gmail, Yahoo and similar are not accepted.</p>
            </div>
            <div>
              <label htmlFor="auth-company" className={labelClass}>Company name</label>
              <input id="auth-company" type="text" autoComplete="organization" required value={companyName}
                onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Analytics" className={inputClass} />
            </div>
          </>
        )}

        <div>
          <label htmlFor="auth-password" className={labelClass}>Password</label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 ${t.hint}`}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {mode === "signup" && (
            <p className={`text-xs mt-1.5 ${t.hint}`}>At least {MIN_PASSWORD} characters, with letters and numbers.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (mode === "signin" ? "Signing in..." : "Creating your workspace...") : (
            <>
              {mode === "signin" ? "Sign in" : "Create account & claim samples"}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className={`mt-5 text-center text-sm ${t.hint}`}>
        {mode === "signin" ? "New to RevGen IQ? " : "Already have an account? "}
        <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          className={`font-medium underline underline-offset-4 ${t.link}`}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
