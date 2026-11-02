"use client";

import React from "react";
import Link from "next/link";
import { Compass, ArrowLeft, Home, ShieldAlert, Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center p-6 selection:bg-brand/30">
      {/* Ambient Aurora Glow */}
      <div className="aurora-bg">
        <i />
        <i />
        <i />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-6">
        {/* Glow Radar Icon */}
        <div className="relative inline-flex items-center justify-center mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-[var(--line2)] flex items-center justify-center shadow-[0_8px_32px_rgba(99,102,241,0.25)] backdrop-blur-xl">
            <Compass className="w-10 h-10 text-brand animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-[11px] font-bold">
            404
          </div>
        </div>

        {/* Heading & Subtext */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Coordinates Not Found
          </h1>
          <p className="text-sm text-[var(--ink2)] leading-relaxed">
            The intelligence radar could not locate the requested resource or workspace route. It may have been relocated, archived, or access is restricted.
          </p>
        </div>

        {/* Status Chip */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--glass)] border border-[var(--line)] text-xs text-[var(--ink3)] font-mono">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>STATUS: HTTP_404_ROUTE_UNREACHABLE</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--grad)] text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-all"
          >
            <Home className="w-4 h-4" />
            Command Center
          </Link>
          <Link
            href="/admin"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--glass)] border border-[var(--line)] text-[var(--ink2)] hover:text-[var(--ink)] hover:border-[var(--line2)] text-xs font-medium transition-all"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Admin Portal
          </Link>
        </div>

        {/* Footer trace */}
        <p className="text-[11px] text-[var(--ink3)] font-mono pt-4">
          HUNT SMARTER · High-Fidelity Multi-Tenant Prospecting System
        </p>
      </div>
    </div>
  );
}
