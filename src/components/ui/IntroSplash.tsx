"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Volume2, VolumeX, Sparkles, Zap, ShieldCheck, Cpu, Radio, ChevronRight, X } from "lucide-react";

export function IntroSplash() {
  return (
    <Suspense fallback={null}>
      <IntroSplashInner />
    </Suspense>
  );
}

// 5 Core Autonomous AI Agents
const AGENTS = [
  { id: "scout", num: "01", name: "SCOUT", role: "Signal Hunter", minPct: 15 },
  { id: "architect", num: "02", name: "ARCHITECT", role: "ICP Matrix", minPct: 35 },
  { id: "identity", num: "03", name: "IDENTITY", role: "Decision Graph", minPct: 55 },
  { id: "radar", num: "04", name: "RADAR", role: "Timing Triggers", minPct: 75 },
  { id: "outreach", num: "05", name: "OUTREACH", role: "Neural Copy", minPct: 90 },
];

function IntroSplashInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOverlayRendered, setIsOverlayRendered] = useState(true);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("INITIALIZING NEURAL REVENUE KERNEL...");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasDismissedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: guaranteed clean dismissal and smooth fade-out
  const dismissSplash = useCallback(() => {
    if (hasDismissedRef.current) return;
    hasDismissedRef.current = true;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    setProgress(100);
    setIsOverlayVisible(false);

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
      } catch {}
    }

    try {
      sessionStorage.setItem("revgen_intro_splash_v1", "1");
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("revgen-splash-pending");
      }
    } catch {}

    fadeTimeoutRef.current = setTimeout(() => {
      setIsOverlayRendered(false);
    }, 450); // 450ms smooth dissolve
  }, []);

  // Keyboard shortcut (ESC or Space) to skip immediately ONLY while splash is actively visible
  useEffect(() => {
    if (!isOverlayRendered || !isOverlayVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (e.key === "Escape" || e.code === "Space") {
        e.preventDefault();
        dismissSplash();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOverlayRendered, isOverlayVisible, dismissSplash]);

  useEffect(() => {
    // 1. Check path & session storage
    const path = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
    const nosplash =
      searchParams?.get("nosplash") === "1" ||
      (typeof window !== "undefined" && window.location.search.includes("nosplash=1"));
    const isSplashForced =
      searchParams?.get("splash") === "1" ||
      searchParams?.get("splash") === "freeze" ||
      searchParams?.get("splash") === "preview" ||
      (typeof window !== "undefined" &&
        (window.location.search.includes("splash=1") ||
          window.location.search.includes("splash=freeze") ||
          window.location.search.includes("splash=preview")));
    const isFrozen =
      searchParams?.get("splash") === "freeze" ||
      (typeof window !== "undefined" && window.location.search.includes("splash=freeze"));

    if (path.startsWith("/card/") || path.startsWith("/api/") || nosplash) {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("revgen-splash-pending");
      }
      setIsOverlayRendered(false);
      return;
    }

    if (!isSplashForced) {
      try {
        if (sessionStorage.getItem("revgen_intro_splash_v1")) {
          if (typeof document !== "undefined") {
            document.documentElement.classList.remove("revgen-splash-pending");
          }
          setIsOverlayRendered(false);
          return;
        }
      } catch {}
    }

    if (isFrozen) {
      setProgress(68);
      setStatusMessage("[03] RESOLVING VERIFIED DECISION-MAKER IDENTITIES...");
      return;
    }

    // 2. Audio Engine: Hook into the head audio or DOM audio
    const headAudio = typeof window !== "undefined" ? (window as any).__REVGEN_INTRO_AUDIO__ : null;
    const domAudio = audioRef.current || (typeof document !== "undefined" ? (document.getElementById("intro-audio") as HTMLAudioElement) : null);
    const audio = headAudio || domAudio;
    activeAudioRef.current = audio;

    const targetDurationMs = 2116; // Exact duration of intro.mp3
    const startTime = performance.now();

    const startAudio = () => {
      if (!audio || audio.ended || hasDismissedRef.current) return;
      audio.volume = 0.95;
      audio.muted = false;

      const p = audio.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlayingAudio(true);
        }).catch(() => {
          // If browser policy temporarily pauses unmuted play, retry with muted then unmute immediately
          audio.muted = true;
          audio.play().then(() => {
            audio.muted = false;
            setIsPlayingAudio(true);
          }).catch(() => {});
        });
      }
    };

    if (audio) {
      audio.volume = 0.95;
      audio.muted = false;

      // Listen for buffering & play events
      audio.addEventListener("playing", () => setIsPlayingAudio(true));
      audio.addEventListener("canplay", startAudio, { once: true });
      audio.addEventListener("canplaythrough", startAudio, { once: true });

      // When audio finishes, cleanly dismiss the splash
      audio.addEventListener("ended", () => {
        dismissSplash();
      }, { once: true });

      // Immediate attempt without delay
      startAudio();
    }

    // Universal passive unlock on any natural cursor movement or interaction
    const unlockOnAnyMovement = () => {
      startAudio();
    };

    window.addEventListener("mousemove", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("pointermove", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("wheel", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("scroll", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("touchstart", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("pointerdown", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("keydown", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("focus", unlockOnAnyMovement, { passive: true, once: true });
    window.addEventListener("mouseenter", unlockOnAnyMovement, { passive: true, once: true });

    // High-performance animation frame loop
    const frameStep = (now: number) => {
      if (hasDismissedRef.current) return;

      let pct = 0;
      // If audio is active, synchronize progress precisely to audio playback
      if (audio && !audio.paused && audio.duration > 0) {
        pct = (audio.currentTime / audio.duration) * 100;
        if (!isPlayingAudio) {
          setIsPlayingAudio(true);
        }
      } else {
        const elapsed = now - startTime;
        pct = (elapsed / targetDurationMs) * 100;
      }

      pct = Math.min(100, Math.max(0, pct));
      setProgress(pct);

      // Dynamic telemetry readout
      if (pct < 18) {
        setStatusMessage("INITIALIZING NEURAL REVENUE KERNEL...");
      } else if (pct < 38) {
        setStatusMessage("[01] INGESTING REAL-TIME MARKET BUYING SIGNALS...");
      } else if (pct < 58) {
        setStatusMessage("[02] FILTERING TARGET ACCOUNT ICP MATRIX...");
      } else if (pct < 78) {
        setStatusMessage("[03] RESOLVING VERIFIED DECISION-MAKER IDENTITIES...");
      } else if (pct < 95) {
        setStatusMessage("[04] CALIBRATING AUTONOMOUS OUTREACH ENGINE...");
      } else {
        setStatusMessage("[05] 5-AGENT PIPELINE SYNCHRONIZED • ACCESS GRANTED");
      }

      if (pct < 100) {
        rafRef.current = requestAnimationFrame(frameStep);
      } else {
        // Animation finished: brief 100ms dwell then clean cinematic dissolve
        setTimeout(() => {
          dismissSplash();
        }, 120);
      }
    };

    rafRef.current = requestAnimationFrame(frameStep);

    // Watchdog Safety Timer
    safetyTimeoutRef.current = setTimeout(() => {
      dismissSplash();
    }, 2850);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      window.removeEventListener("mousemove", unlockOnAnyMovement);
      window.removeEventListener("pointermove", unlockOnAnyMovement);
      window.removeEventListener("wheel", unlockOnAnyMovement);
      window.removeEventListener("scroll", unlockOnAnyMovement);
      window.removeEventListener("touchstart", unlockOnAnyMovement);
      window.removeEventListener("pointerdown", unlockOnAnyMovement);
      window.removeEventListener("keydown", unlockOnAnyMovement);
      window.removeEventListener("focus", unlockOnAnyMovement);
      window.removeEventListener("mouseenter", unlockOnAnyMovement);
      if (audio) {
        try {
          audio.pause();
        } catch {}
      }
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("revgen-splash-pending");
      }
    };
  }, [pathname, searchParams, dismissSplash]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = activeAudioRef.current || audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      setIsMuted(audio.muted);
    }
  };

  if (!isOverlayRendered) return null;

  // Kinetic Calculations
  const ringRotation = progress * 3.6;
  const ringScale = 0.85 + 0.15 * Math.min(1, progress / 50);
  const logoScale = 0.92 + 0.08 * Math.min(1, progress / 60);

  return (
    <>
      {/* HTML5 Audio Element in DOM with autoPlay */}
      <audio
        id="intro-audio"
        ref={audioRef}
        src="/audio/intro.mp3"
        autoPlay
        preload="auto"
        playsInline
      />

      <div
        id="revgen-intro-splash"
        className={`fixed inset-0 w-screen h-[100dvh] min-h-screen z-[99999] flex flex-col justify-between bg-[#020617] text-white overflow-hidden select-none transition-all duration-400 ease-out ${
          isOverlayVisible
            ? "opacity-100 scale-100 backdrop-blur-none"
            : "opacity-0 scale-[1.03] filter blur-sm pointer-events-none"
        }`}
        style={{ height: "100vh", width: "100vw" }}
      >
        {/* Ambient Spatial Lighting & Cyber Grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Cybernetic Dot & Line Grid */}
          <div className="absolute inset-0 splash-cyber-grid opacity-60" />

          {/* Deep Dynamic Aurora Spheres */}
          <div className="splash-aurora-glow opacity-75" />
          <div className="absolute top-1/4 left-1/4 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-[90px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[520px] h-[520px] rounded-full bg-indigo-600/15 blur-[100px] animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px]" />

          {/* Laser Streaks */}
          <div className="splash-streak splash-streak-1 opacity-70" />
          <div className="splash-streak splash-streak-2 opacity-60" />
        </div>

        {/* TOP HUD BAR */}
        <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-8 border-b border-white/[0.06] bg-slate-950/40 backdrop-blur-md">
          {/* Brand Mark & Kernel Version */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-pink-500 p-[1px] shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-wider text-white">RevGen AI</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.6.4
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>NEURAL ENGINE ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Skip Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissSplash();
            }}
            className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.12] hover:border-cyan-400/50 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm text-xs font-mono"
            title="Press ESC or Click to enter immediately"
          >
            <span className="tracking-wide">SKIP</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 group-hover:text-cyan-300 font-mono border border-slate-700">
              ESC
            </kbd>
          </button>
        </header>

        {/* CENTER HOLOGRAPHIC STAGE */}
        <main className="relative z-10 flex flex-col items-center justify-center px-4 my-auto">
          {/* Holographic Gyroscopic 3D Logo */}
          <div className="relative mb-6 sm:mb-8 splash-hologram-stage">
            {/* Sonic Wave Shockwaves on Final Phase */}
            {progress >= 70 && (
              <>
                <div className="splash-sonic-wave splash-sonic-1" />
                <div className="splash-sonic-wave splash-sonic-2" />
              </>
            )}

            {/* Ambient Core Glow Ring */}
            <div
              className="splash-glow-ring"
              style={{
                opacity: 0.4 + 0.6 * (progress / 100),
                transform: `translate(-50%, -50%) scale(${0.8 + 0.3 * (progress / 100)})`,
              }}
            />

            {/* Outer Gyro Ring with Compass Notches */}
            <div
              className="splash-orbital-ring-outer transition-transform duration-100"
              style={{
                width: "160px",
                height: "160px",
                transform: `scale(${ringScale}) rotate(${ringRotation}deg)`,
                borderColor: progress > 80 ? "rgba(56, 189, 248, 0.7)" : "rgba(129, 140, 248, 0.4)",
              }}
            >
              {/* Compass Ticks */}
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
              <span className="absolute top-1/2 -left-1 -translate-y-1/2 w-1 h-1 rounded-full bg-indigo-400" />
              <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-1 h-1 rounded-full bg-pink-400 shadow-[0_0_8px_#ec4899]" />
            </div>

            {/* Inner Gyro Ring Counter-Rotating */}
            <div
              className="splash-orbital-ring-inner transition-transform duration-100"
              style={{
                width: "130px",
                height: "130px",
                transform: `scale(${ringScale}) rotate(-${ringRotation * 1.4}deg)`,
                borderColor: progress > 80 ? "rgba(236, 72, 153, 0.6)" : "rgba(236, 72, 153, 0.35)",
              }}
            />

            {/* Central Faceted Logo Core */}
            <div
              className="splash-logo-core relative transition-transform duration-150"
              style={{
                transform: `scale(${logoScale})`,
              }}
            >
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-[0_0_35px_rgba(99,102,241,0.7)]"
                aria-label="HUNT SMARTER Holographic Core"
              >
                <defs>
                  <linearGradient id="splashFacetSweep" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>

                  <linearGradient id="splashFacet2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>

                  <linearGradient id="splashFacet3" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="60%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>

                  <filter id="splashNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3.2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Orbiting Strobe Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="url(#splashFacetSweep)"
                  strokeWidth="1.5"
                  strokeDasharray="8 6"
                  className="opacity-75 animate-[spin_10s_linear_infinite]"
                />

                {/* Facet 1: Left Stem */}
                <polygon
                  points="50,15 24,36 34,54 21,88 32,82 46,38"
                  fill="url(#splashFacetSweep)"
                  filter="url(#splashNeonGlow)"
                  className="splash-facet-polygon"
                />

                {/* Facet 2: Upper Loop */}
                <polygon
                  points="52,15 78,38 52,68 43,58 48,34"
                  fill="url(#splashFacet2)"
                  filter="url(#splashNeonGlow)"
                  className="splash-facet-polygon"
                />

                {/* Facet 3: Diagonal Right Leg */}
                <polygon
                  points="42,61 68,88 50,88 36,73"
                  fill="url(#splashFacet3)"
                  filter="url(#splashNeonGlow)"
                  className="splash-facet-polygon"
                />
              </svg>
            </div>
          </div>

          {/* Brand Typography */}
          <div className="space-y-1.5 text-center mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-cyan-200 drop-shadow-[0_4px_20px_rgba(99,102,241,0.55)]">
              RevGen AI
            </h1>
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono tracking-[0.25em] uppercase text-cyan-300/90 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
              <span>AI Revenue Operating System</span>
            </div>
          </div>

          {/* 5-AGENT NEURAL MESH PIPELINE */}
          <div className="w-full max-w-xl mb-6 relative">
            {/* Connecting Laser Data Bus behind nodes */}
            <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-[2px] bg-slate-800/80 rounded-full overflow-hidden pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 shadow-[0_0_10px_#38bdf8] transition-all duration-150"
                style={{ width: `${Math.min(100, Math.max(0, (progress / 90) * 100))}%` }}
              />
            </div>

            <div className="relative z-10 grid grid-cols-5 gap-1.5 sm:gap-2">
              {AGENTS.map((agent) => {
                const isActivated = progress >= agent.minPct;
                return (
                  <div
                    key={agent.id}
                    className={`relative p-2 rounded-lg border transition-all duration-300 text-center flex flex-col items-center justify-center ${
                      isActivated
                        ? "bg-gradient-to-b from-indigo-950/70 to-slate-900/90 border-cyan-400/50 shadow-[0_0_14px_rgba(6,182,212,0.25)]"
                        : "bg-slate-900/30 border-white/[0.05] opacity-40"
                    }`}
                  >
                    {/* Node status dot */}
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActivated
                            ? "bg-cyan-400 shadow-[0_0_6px_#38bdf8] animate-pulse"
                            : "bg-slate-600"
                        }`}
                      />
                      <span className="text-[9px] font-mono font-bold text-slate-400">
                        {agent.num}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] sm:text-[11px] font-mono font-bold tracking-wider ${
                        isActivated ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {agent.name}
                    </span>

                    <span className="hidden sm:inline text-[8px] font-mono text-slate-400 truncate max-w-full">
                      {agent.role}
                    </span>

                    {/* Progress beam at bottom of node */}
                    {isActivated && (
                      <div className="absolute bottom-0 inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PROGRESS BAR & LASER SPARK */}
          <div className="w-full max-w-md space-y-2.5">
            {/* Dual Track Laser Progress Bar */}
            <div className="relative h-2 w-full bg-slate-900/90 rounded-full border border-white/10 p-[2px] overflow-hidden backdrop-blur-md shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 rounded-full transition-all duration-75 ease-linear relative"
                style={{ width: `${progress}%` }}
              >
                {/* Leading Laser Spark */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white splash-laser-spark" />
                {/* Shimmer sweep */}
                <div className="absolute inset-0 splash-shimmer-sweep bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </div>
            </div>

            {/* Dynamic Telemetry Status & Percentage */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 px-1">
              <span className="flex items-center gap-2 truncate text-cyan-300 font-medium tracking-wide">
                <Radio className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
                <span className="truncate">{statusMessage}</span>
              </span>
              <span className="text-white font-bold tabular-nums text-xs ml-3">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </main>

        {/* BOTTOM TELEMETRY FOOTER */}
        <footer className="relative z-20 flex items-center justify-between px-6 py-4 sm:px-8 border-t border-white/[0.06] bg-slate-950/40 backdrop-blur-md text-[10px] font-mono text-slate-400">
          {/* Security & Cluster Specs */}
          <div className="hidden sm:flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>ENCRYPTION: AES-256 GCM</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>LATENCY: 11ms</span>
            </span>
          </div>

          {/* Sound Controls */}
          <div className="flex items-center gap-3 ml-auto pointer-events-auto">
            {isPlayingAudio && (
              <button
                type="button"
                onClick={toggleMute}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    <span>MUTED</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    {/* Dynamic EQ bars */}
                    <div className="flex items-end gap-[2px] h-3">
                      <span className="w-[2px] bg-cyan-400 rounded-full splash-eq-1" />
                      <span className="w-[2px] bg-indigo-400 rounded-full splash-eq-2" />
                      <span className="w-[2px] bg-pink-400 rounded-full splash-eq-3" />
                      <span className="w-[2px] bg-cyan-400 rounded-full splash-eq-4" />
                    </div>
                    <span>AUDIO ACTIVE</span>
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </>
  );
}
