"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Execution Interrupted - Application runtime error intercepted:", error);
    if (error?.message) {
      console.error("Runtime error message:", error.message);
    }
    if (error?.stack) {
      console.error("Component stack / Error stack:", error.stack);
    }
  }, [error]);

  const handleClearSessionAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    } catch (e) {
      console.warn("Could not clear storage:", e);
    }
    window.location.href = "/";
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center p-6 selection:bg-brand/30">
      <div className="aurora-bg">
        <i />
        <i />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-6 glass-card p-8 border border-[var(--line2)] shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--ink)]">
            Execution Interrupted
          </h2>
          <p className="text-xs text-[var(--ink2)] leading-relaxed">
            The platform encountered an unexpected client state. Sensitive details have been safely isolated.
          </p>
        </div>

        {error?.digest && (
          <div className="px-3 py-1.5 rounded-lg bg-[var(--glass)] border border-[var(--line)] font-mono text-[11px] text-[var(--ink3)] truncate">
            Digest Ref: {error.digest}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary text-xs inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Action
          </button>
          <button
            type="button"
            onClick={handleClearSessionAndReload}
            className="btn-ghost text-xs inline-flex items-center gap-2 border border-rose-500/30 text-rose-300 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Cache & Restart
          </button>
          <Link
            href="/"
            className="btn-ghost text-xs inline-flex items-center gap-2 border border-[var(--line)]"
          >
            <Home className="w-3.5 h-3.5" />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

