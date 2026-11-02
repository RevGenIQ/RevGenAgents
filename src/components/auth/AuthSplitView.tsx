"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Key,
  Lock,
  Mail,
  Building,
  User,
} from "lucide-react";

interface AuthSplitViewProps {
  initialMode?: "signin" | "signup";
}

export function AuthSplitView({ initialMode = "signin" }: AuthSplitViewProps) {
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [prospectingGoal, setProspectingGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.currentTime = 0;
      video.play().catch(() => {});
    }

    const videoLoopInterval = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime >= 10) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }, 80);

    const audioSrc =
      "/ElevenLabs_2026-10-20T07_47_12_Eve%20-%20Narrative%20%26%20Audiobooks_pvc_sp95_s71_sb37_se0_b_m2.mp3";
    const audio = new Audio(audioSrc);
    audioRef.current = audio;
    audio.loop = false;
    audio.preload = "auto";
    audio.play().catch(() => {});

    return () => {
      clearInterval(videoLoopInterval);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.currentTime >= 10) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (val.includes("@")) {
      const parts = val.split("@");
      if (parts[1] && !companyDomain) {
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
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const res = await login(identifier.trim(), password);
        if (!res.success) {
          setError(
            res.error ||
              "Access Denied. Only Clients and Humagents created or approved by the Admin can log in."
          );
        } else {
          router.push(res.redirectUrl || "/");
        }
      } else {
        const res = await signup({
          fullName: fullName.trim() || email.split("@")[0],
          email: email.trim(),
          companyDomain:
            companyDomain.trim() ||
            (email.includes("@") ? email.split("@")[1] : ""),
          companyName:
            companyName.trim() ||
            (companyDomain
              ? companyDomain.split(".")[0].toUpperCase()
              : "Company"),
          jobTitle: jobTitle.trim(),
          prospectingGoal: prospectingGoal.trim(),
        });
        if (!res.success) {
          setError(res.error || "Failed to submit access request");
        } else {
          setSuccessMsg(
            res.message ||
              "Your request has been sent to the RevGen AI Admin. Once approved, your generated Login ID & Password will be sent to your registered email."
          );
          setFullName("");
          setEmail("");
          setCompanyName("");
          setCompanyDomain("");
          setJobTitle("");
          setProspectingGoal("");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#070b13] text-white">
      <header className="w-full px-6 lg:px-10 py-4 border-b border-white/10 bg-[#070b13] z-30 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="relative w-10 h-10 rounded-xl bg-black/85 border border-white/20 flex items-center justify-center p-2 shadow-xl group-hover:border-[#5B4BFF]/80 transition-colors">
            <RevGenLogo animated className="w-full h-full" />
          </div>
          <div className="flex flex-col">
            <span
              className="font-extrabold text-2xl tracking-tight leading-tight"
              style={{ color: "#ffffff" }}
            >
              RevGen AI
            </span>
            <span className="text-[11px] font-medium tracking-wide text-slate-300">
              AI Revenue Operating System
            </span>
          </div>
        </Link>
      </header>

      <div className="flex-1 w-full flex flex-col lg:flex-row p-4 lg:p-6 gap-6 min-h-0">
        <div className="relative flex-1 min-h-[380px] lg:min-h-full rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
          <video
            ref={videoRef}
            src="/Business%20Professionals%20and%20Corporate%20Stock%20Video%20Footage%20by%20FILMPAC_1440p.mp4"
            autoPlay
            loop
            muted
            playsInline
            onTimeUpdate={handleVideoTimeUpdate}
            className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            style={{ opacity: 1, filter: "brightness(0.98) contrast(1.04)" }}
          />
        </div>

        <div className="w-full lg:w-[460px] shrink-0 flex flex-col justify-between p-6 lg:p-10 rounded-2xl bg-[#0d1424] border border-white/10 shadow-2xl">
          <div className="w-full mx-auto my-auto py-2">
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {mode === "signin" ? "Sign in to RevGen AI" : "Request Client Access"}
              </h1>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {mode === "signin"
                  ? "Enter your Admin-issued Login ID or registered email to enter your authorized portal."
                  : "Submit your company registration below. Once the Admin approves your request, your generated Login ID & Password will be shared to your email."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {mode === "signin" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Login ID or Registered Email
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Login ID or work email"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] focus:ring-2 focus:ring-[#5B4BFF]/30 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] focus:ring-2 focus:ring-[#5B4BFF]/30 transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your Full Name"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Company Name *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Inc."
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Working Email (Credentials Sent Here) *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={handleEmailChange}
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Company Domain *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyDomain}
                      onChange={(e) => setCompanyDomain(e.target.value)}
                      placeholder="company.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                      Prospecting Goal / Target ICP
                    </label>
                    <input
                      type="text"
                      value={prospectingGoal}
                      onChange={(e) => setProspectingGoal(e.target.value)}
                      placeholder="Target enterprise decision-makers & buying signals"
                      className="w-full px-4 py-3 rounded-xl bg-[#172138] border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#5B4BFF] transition-all"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-[#5B4BFF] hover:bg-[#4F46E5] text-white font-bold text-sm shadow-lg shadow-[#5B4BFF]/30 hover:shadow-[#5B4BFF]/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>
                      {mode === "signin"
                        ? "Sign In"
                        : "Submit Access Request to Admin"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-300">
              {mode === "signin" ? (
                <span>
                  Need client access to RevGen AI?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setMode("signup");
                    }}
                    className="text-[#818cf8] hover:text-[#a5b4fc] font-semibold underline underline-offset-4 ml-1 transition-colors cursor-pointer"
                  >
                    Request Client Access
                  </button>
                </span>
              ) : (
                <span>
                  Already have Admin-approved credentials?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setMode("signin");
                    }}
                    className="text-[#818cf8] hover:text-[#a5b4fc] font-semibold underline underline-offset-4 ml-1 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 font-mono mt-6">
            © 2026 RevGen AI · Enterprise B2B Operating System
          </div>
        </div>
      </div>
    </div>
  );
}
