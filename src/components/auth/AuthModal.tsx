"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  X,
  Mail,
  Lock,
  Globe,
  Building,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Key,
} from "lucide-react";
import { RevGenLogo } from "@/components/ui/RevGenLogo";

export function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    openAuthModal,
    login,
    signup,
  } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Client Access Request (Registration Form) fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [prospectingGoal, setProspectingGoal] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (val.includes("@")) {
      const parts = val.split("@");
      if (parts[1]) {
        const dom = parts[1].toLowerCase().trim();
        if (
          !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(
            dom
          )
        ) {
          setCompanyDomain(dom);
          if (!companyName) {
            const prefix = dom.split(".")[0];
            setCompanyName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequestSuccessMessage(null);
    setIsLoading(true);

    try {
      if (authModalMode === "signin") {
        const res = await login(identifier.trim(), password);
        if (!res.success) {
          setError(res.error || "Invalid credentials or unapproved account.");
        } else if (res.redirectUrl) {
          window.location.href = res.redirectUrl;
        }
      } else {
        const res = await signup({
          fullName: fullName.trim(),
          email: email.trim(),
          companyDomain: companyDomain.trim(),
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
          prospectingGoal: prospectingGoal.trim(),
        });
        if (!res.success) {
          setError(res.error || "Failed to submit access request.");
        } else {
          setRequestSuccessMessage(
            res.message ||
              "Your request has been submitted to the Admin. Once approved, your generated Login ID & Password will be sent to your registered email."
          );
          setFullName("");
          setEmail("");
          setCompanyDomain("");
          setCompanyName("");
          setJobTitle("");
          setProspectingGoal("");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={closeAuthModal}
      />

      <div className="relative z-10 w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <RevGenLogo className="w-7 h-7 text-indigo-600" />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900">
                RevGen AI
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Role-Authorized Portal Access
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sign In vs Request Client Access Tabs */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                openAuthModal("signin");
                setError(null);
                setRequestSuccessMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                authModalMode === "signin"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Portal Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                openAuthModal("signup");
                setError(null);
                setRequestSuccessMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                authModalMode === "signup"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Request Client Access
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {requestSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Access Request Sent to Admin</div>
                <p className="leading-relaxed">{requestSuccessMessage}</p>
              </div>
            </div>
          )}

          {authModalMode === "signin" ? (
            <>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                  Login ID or Registered Email
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-indigo-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Admin-generated ID or work email"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Enter the credentials provided by RevGen AI Admin. Your role automatically routes you to your dedicated portal.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-600 font-bold mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span>Verifying Role &amp; Credentials...</span>
                ) : (
                  <>
                    <span>Sign In to RevGen AI</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                Submit your company details below to request access to{" "}
                <strong className="text-slate-900">RevGen AI</strong>. Once the Admin approves your request, your generated Login ID &amp; Password will be shared to your registration email.
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    Role / Title
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. VP Growth"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                  Working Email (Credentials will be sent here) *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    Company Domain *
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={companyDomain}
                      onChange={(e) => setCompanyDomain(e.target.value)}
                      placeholder="company.com"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                    Company Name *
                  </label>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company Inc."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-600 font-bold mb-1">
                  Target ICP / Prospecting Goal
                </label>
                <input
                  type="text"
                  value={prospectingGoal}
                  onChange={(e) => setProspectingGoal(e.target.value)}
                  placeholder="e.g. Target enterprise SaaS & GCC decision-makers"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span>Submitting Request to Admin...</span>
                ) : (
                  <>
                    <span>Submit Access Request to Admin</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
