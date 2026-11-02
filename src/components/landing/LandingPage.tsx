"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { plusJakarta } from "@/app/fonts";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { useAuth } from "@/context/AuthContext";
import { SignalGraphHero } from "@/components/landing/hero/SignalGraphHero";
import {
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Radar,
  Send,
  Eye,
  Cpu,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface LandingPageProps {
  onEnterApp: () => void;
}

const AGENTS_LIST = [
  {
    id: "01",
    name: "Scout",
    stage: "STAGE 01",
    role: "SERPER & NEWS CRAWLER",
    description: "Collects live evidence across web, news, and verified company indexes.",
    color: "#4F46E5",
    tag: "LIVE DISCOVERY",
    metric: "40+ Sources / sec",
  },
  {
    id: "02",
    name: "Analyst",
    stage: "STAGE 02",
    role: "SIGNAL EXTRACTION ENGINE",
    description: "Extracts high-intent accounts and detects verifiable buying signals.",
    color: "#7C3AED",
    tag: "BUYING INTENT",
    metric: "91% Confidence",
  },
  {
    id: "03",
    name: "Matcher",
    stage: "STAGE 03",
    role: "BUYER PERSONA GRAPH",
    description: "Builds buyer persona profiles and pairs signals with verified champions.",
    color: "#9333EA",
    tag: "CHAMPION MATCH",
    metric: "Verified Personas",
  },
  {
    id: "04",
    name: "Verifier",
    stage: "STAGE 04",
    role: "2-SOURCE CORROBORATION",
    description: "Enforces 2-source corroboration rule before triggering human QA gate.",
    color: "#0284C7",
    tag: "EVIDENCE GATE",
    metric: "100% Corroborated",
  },
  {
    id: "05",
    name: "Writer",
    stage: "STAGE 05",
    role: "CALIBRATED COPY CRAFTER",
    description: "Generates calibrated first-lines directly pinned to surfaced evidence.",
    color: "#DB2777",
    tag: "HYPER-PERSONALIZED",
    metric: "Source-Pinned",
  },
];

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [intentItems, setIntentItems] = useState<any[]>([]);
  const [intentUpdatedAt, setIntentUpdatedAt] = useState<string>("");
  const [isRefreshingIntent, setIsRefreshingIntent] = useState<boolean>(false);

  const loadLiveIntentStream = async () => {
    setIsRefreshingIntent(true);
    try {
      const res = await fetch("/api/public-intent");
      if (res.ok) {
        const data = await res.json();
        setIntentItems(data.items || []);
        setIntentUpdatedAt(data.updatedAt || new Date().toISOString());
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshingIntent(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);

    loadLiveIntentStream();
    const interval = setInterval(loadLiveIntentStream, 45000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`${plusJakarta.className} relative min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-indigo-600/20 overflow-x-hidden`}
    >
      {/* ════════════════ DARK HERO WRAPPER (UP THROUGH MARQUEE) ════════════════ */}
      <div className="relative bg-[#07001E] text-white overflow-hidden">
        {/* BACKGROUND GRAPHICS: Radial navy/indigo glow + glowing purple sphere + thin gradient arc lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(91,75,255,0.22),rgba(11,0,51,0.95)_60%,#07001E_100%)]" />
        </div>

        {/* NAVBAR */}
        <header
          className={`fixed top-0 inset-x-0 z-50 h-16 border-b transition-all duration-300 px-4 lg:px-10 flex items-center justify-between ${
            isScrolled
              ? "bg-black/95 backdrop-blur-md border-white/10 shadow-xl shadow-black/50"
              : "bg-black border-white/10"
          }`}
        >
          {/* Left: Hamburger Icon + Logo + "RevGen AI" */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors md:hidden"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-[#5B4BFF] via-[#8B5CF6] to-[#EC4899] rounded-xl blur-md opacity-75 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 animate-pulse" />
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/90 border border-white/20 flex items-center justify-center p-1.5 shadow-2xl backdrop-blur-md group-hover:border-[#5B4BFF]/80 transition-colors">
                  <RevGenLogo animated className="w-full h-full transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="font-extrabold text-lg sm:text-xl tracking-tight drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)]"
                  style={{ color: "#ffffff" }}
                >
                  RevGen AI
                </span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide text-white/70">
            <a
              href="#live-intent-stream"
              className="hover:text-white transition-colors py-1"
            >
              Live Intent
            </a>
            <a
              href="#agents"
              className="hover:text-white transition-colors py-1"
            >
              Agents
            </a>
            <a
              href="#platform"
              className="hover:text-white transition-colors py-1"
            >
              Platform
            </a>
            <a
              href="#credits"
              className="hover:text-white transition-colors py-1"
            >
              Credits
            </a>
          </nav>

          {/* Right: Sign in + Request Access */}
          <div className="flex items-center gap-3 sm:gap-4">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onEnterApp}
                className="bg-[#5B4BFF] hover:bg-[#4F40E5] text-white text-xs px-5 py-2.5 rounded-xl font-semibold shadow-[0_4px_14px_rgba(91,75,255,0.39)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5"
              >
                <span>Open Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-medium text-white hover:text-white/80 transition-colors px-2 py-1"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="bg-[#5B4BFF] hover:bg-[#4F40E5] text-white text-xs px-4.5 py-2.5 rounded-xl font-semibold shadow-[0_4px_14px_rgba(91,75,255,0.39)] transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Request Access
                </Link>
              </>
            )}
          </div>
        </header>

        {/* MOBILE DROPDOWN DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed top-16 inset-x-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 px-6 py-6 flex flex-col gap-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 md:hidden">
            <a
              href="#live-intent-stream"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white py-2 border-b border-white/5"
            >
              Live Intent
            </a>
            <a
              href="#agents"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white py-2 border-b border-white/5"
            >
              Agents
            </a>
            <a
              href="#platform"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white py-2 border-b border-white/5"
            >
              Platform
            </a>
            <a
              href="#credits"
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/80 hover:text-white py-2 border-b border-white/5"
            >
              Credits
            </a>
            <div className="pt-2 flex flex-col gap-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 rounded-lg border border-white/20 text-white font-medium hover:bg-white/5"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 rounded-lg bg-[#5B4BFF] text-white font-semibold shadow-lg shadow-[#5B4BFF]/30"
              >
                Request Access
              </Link>
            </div>
          </div>
        )}

        {/* ════════════════ SECTION 1: HERO (CENTERED) ════════════════ */}
        <section className="relative z-10 pt-28 sm:pt-32 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[11px] sm:text-xs font-mono tracking-wider text-indigo-200 font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5B544]" aria-hidden="true" />
              <span>RevGen AI · Intelligent B2B Prospecting</span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-[64px] font-extrabold tracking-tight leading-[1.06] max-w-3xl text-balance"
              style={{ color: "#ffffff" }}
            >
              Finding the right accounts takes too long.
              <span className="block mt-2 text-[#C7CCFF]">
                Now it doesn&apos;t have to.
              </span>
            </h1>

            <p
              className="mt-6 text-base lg:text-lg max-w-xl leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.75)" }}
            >
              AI agents find accounts, extract buying signals, map decision makers,
              verify emails and write outreach, with human approval.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={onEnterApp}
                  className="inline-flex items-center gap-2 bg-[#5B4BFF] hover:bg-[#4F40E5] text-white text-sm px-6 py-3 rounded-xl font-semibold shadow-[0_8px_24px_rgba(91,75,255,0.45)] transition-all hover:-translate-y-0.5"
                >
                  Open Portal
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 bg-[#5B4BFF] hover:bg-[#4F40E5] text-white text-sm px-6 py-3 rounded-xl font-semibold shadow-[0_8px_24px_rgba(91,75,255,0.45)] transition-all hover:-translate-y-0.5"
                  >
                    Request Access
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center px-6 py-3 rounded-xl border border-white/20 text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 relative h-[340px] sm:h-[440px] lg:h-[540px] -mx-4 sm:mx-0">
            <SignalGraphHero />
          </div>
        </section>

        {/* ════════════════ SECTION 2: DIRECTLY BELOW HERO (TWO-COLUMN PIPELINE) ════════════════ */}
        <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6 text-left">
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12]"
                style={{ color: "#ffffff" }}
              >
                A verified pipeline, <br />
                <span className="bg-gradient-to-r from-[#5B4BFF] via-[#8B5CF6] to-[#C084FC] bg-clip-text text-transparent">
                  built by AI agents.
                </span>
              </h2>

              <p
                className="text-sm sm:text-base max-w-xl leading-relaxed font-normal"
                style={{ color: "rgba(255, 255, 255, 0.75)" }}
              >
                RevGen AI scans for live buying signals, matches the right buyer
                personas and drafts a calibrated first line, so your team walks into
                every conversation with a reason to talk.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  href="/login"
                  className="bg-[#5B4BFF] hover:bg-[#4F40E5] text-white text-xs sm:text-sm py-3 px-6 rounded-xl font-semibold shadow-[0_4px_16px_rgba(91,75,255,0.45)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 group cursor-pointer"
                >
                  <span>Build my target list</span>
                  <ArrowRight className="w-4 h-4 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <Link
                  href="/signup"
                  className="border border-white/20 hover:border-white/40 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs sm:text-sm py-3 px-5 rounded-xl font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Request Client Access
                </Link>
              </div>

              <p className="text-[11px] font-mono text-white/45">
                5 reviewed sample accounts first · 3+ verified contacts per account · AI research + human QA
              </p>
            </div>

            {/* Right Column: SAMPLE ACCOUNT CARD Answering the 4 Core Questions */}
            <div className="lg:col-span-5">
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#5B4BFF]/40 shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all duration-300 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-white/60 font-semibold">
                    REVIEWED SAMPLE ACCOUNT CARD · #1 OF 5
                  </span>
                  <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                    P1 · HUMAN VERIFIED
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center font-bold text-white text-xs">
                      SA
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Saffron Auto Components (saffronauto.in)
                      </h3>
                      <p className="text-[11px] text-white/60">
                        Automotive Components · Pune · 650 Emp (Est.)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400">
                      PASS
                    </div>
                    <div className="text-[9px] font-mono uppercase text-white/50">
                      MANDATORY FIT
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-indigo-300 font-bold block">
                      1. Why this company?
                    </span>
                    <span className="text-white/85">
                      Mid-market Tier-1 auto manufacturer operating 3 plants in Pune &amp; Chennai matching mandatory headcount and sector rules.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">
                      2. Why now? (Prospecting Hypothesis · Sep 2026)
                    </span>
                    <span className="text-white/85">
                      Commissioning ₹220 Cr Chakan EV line and hiring 60 plant supervisors within 6-month window.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-cyan-300 font-bold block">
                      3. Who should we approach? (3/3 Roles Verified)
                    </span>
                    <span className="text-white/85">
                      • <strong>Buyer:</strong> Executive Director Operations (Deliverable)<br />
                      • <strong>Influencer:</strong> VP Supply Chain &amp; Planning (Deliverable)<br />
                      • <strong>Implementation:</strong> Plant Head Chakan (Deliverable)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/60 pt-2 border-t border-white/10">
                  <span>
                    <strong className="text-indigo-300">4. Evidence:</strong> NSE Filing + Economic Times
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Human QA Approved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER MARQUEE: SCROLLING SIGNALS STRIP IN INDIGO */}
        <div className="w-full border-y border-white/10 bg-[#0B0033]/80 backdrop-blur-md py-3.5 overflow-hidden select-none relative z-10 shadow-lg">
          <div className="animate-ticker text-xs font-mono text-white/70 flex items-center gap-10 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className="text-[#5B4BFF]">⚡</span>
              <span>Auto-components maker in Pune announces ₹220 Cr plant expansion</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[#5B4BFF]">⚡</span>
              <span>Specialty chemicals firm appointed a new VP Operations</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[#5B4BFF]">⚡</span>
              <span>Logistics SaaS closed Series B, hiring 40 sales reps</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[#5B4BFF]">⚡</span>
              <span>Tier-1 casting vendor opens expansion line in Chennai</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[#5B4BFF]">⚡</span>
              <span>Auto-components maker in Pune announces ₹220 Cr plant expansion</span>
            </div>
            <span className="text-white/20">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[#5B4BFF]">⚡</span>
              <span>Specialty chemicals firm appointed a new VP Operations</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════ LIGHT-THEMED SECTIONS BELOW THE MARQUEE ════════════════ */}
      <div className="bg-[#f8fafc] text-slate-900 flex-1">
        {/* ════════════════ MINIMALIST LIVE INTENT SECTION ════════════════ */}
        <section
          id="live-intent-stream"
          className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-mono uppercase tracking-wider text-indigo-700 font-bold mb-3">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                Live Intent
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Live Intent
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 max-w-xl">
                Real-time buying signals detected across high-velocity companies. Click any intent card to inspect the underlying source directly.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {intentUpdatedAt && (
                <span className="text-[11px] font-mono text-slate-400">
                  Synced {new Date(intentUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                type="button"
                onClick={loadLiveIntentStream}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-2xs transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingIntent ? "animate-spin text-indigo-600" : ""}`} />
                <span>{isRefreshingIntent ? "Syncing..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Minimalist Stylish Intent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {intentItems.slice(0, 9).map((item) => {
              const initials = String(item.company || "CO")
                .slice(0, 2)
                .toUpperCase();
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.url) {
                      window.open(item.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && item.url) {
                      window.open(item.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="group rounded-2xl p-5 bg-white hover:bg-slate-50/70 border border-slate-200/90 hover:border-indigo-400 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4 cursor-pointer"
                >
                  {/* Top Row: Company Logo + Name/Domain + LinkedIn Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {item.logoUrl ? (
                          <img
                            src={item.logoUrl}
                            alt={item.company}
                            className="w-full h-full object-contain p-1.5"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="text-xs font-extrabold text-indigo-600">${initials}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs font-extrabold text-indigo-600">
                            {initials}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {item.company}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500 truncate">
                          {item.domain}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={
                          item.linkedinUrl ||
                          `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(
                            item.company || ""
                          )}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`View ${item.company} on LinkedIn`}
                        className="w-8 h-8 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2] text-[#0A66C2] hover:text-white border border-[#0A66C2]/20 flex items-center justify-center transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                        </svg>
                      </a>
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                        {item.intentScore}
                      </span>
                    </div>
                  </div>

                  {/* Signal Headline & Summary */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {/* Minimal Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {item.signalType || "Live Signal"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ════════════════ SECTION 3: FIVE AGENTS (LIGHT THEME) ════════════════ */}
        <section
          id="agents"
          className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-slate-200/80"
        >
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-mono tracking-wider uppercase text-indigo-700 font-bold mb-3">
              AGENT MESH ARCHITECTURE
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Five agents. One evidence trail.
            </h2>
            <p className="text-sm mt-3 leading-relaxed text-slate-600">
              Each agent is purpose-built to execute a dedicated research stage with
              verifiable evidence and human review.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {AGENTS_LIST.map((agent) => (
              <div
                key={agent.id}
                className="group relative rounded-2xl p-6 bg-white border border-slate-200 hover:border-indigo-300 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: agent.color }}
                      />
                      <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">
                        AGENT #{agent.id}
                      </span>
                    </div>

                    <span
                      className="text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded"
                      style={{
                        color: agent.color,
                        backgroundColor: `${agent.color}12`,
                        border: `1px solid ${agent.color}30`,
                      }}
                    >
                      {agent.stage}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">
                    {agent.name}
                  </h3>

                  <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase mb-3 font-semibold">
                    {agent.role}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal mb-6">
                    {agent.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] font-mono">
                  <span
                    className="text-[10px] font-bold tracking-wider uppercase"
                    style={{ color: agent.color }}
                  >
                    {agent.tag}
                  </span>
                  <span className="text-slate-700 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                    {agent.metric}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════ PLATFORM PILLARS (LIGHT THEME) ════════════════ */}
        <section
          id="platform"
          className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-slate-200/80"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 space-y-3.5 shadow-2xs transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                <Radar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Radar</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Find, verify and score accounts showing live buying signals, every claim linked to its source.
              </p>
            </div>

            <div className="bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 space-y-3.5 shadow-2xs transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Relay</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Agentic outbound with deliverability guardrails. Nothing sends without approval.
              </p>
            </div>

            <div className="bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 space-y-3.5 shadow-2xs transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Halo</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Measure how 6 AI engines describe you with a weekly Trust Index.
              </p>
            </div>

            <div className="bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 space-y-3.5 shadow-2xs transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">OS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Agent Mesh, Human QA Verification and a hash-chained audit log behind every action.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════ CREDIT ECONOMY (LIGHT THEME) ════════════════ */}
        <section
          id="credits"
          className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-slate-200/80"
        >
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-mono tracking-wider uppercase text-indigo-700 font-bold mb-3">
              CREDIT ECONOMY
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              The deeper the search, the stronger the evidence.
            </h2>
            <p className="text-sm mt-3 leading-relaxed text-slate-600">
              Every workspace starts with 100 free credits. Failed searches are refunded automatically; upheld challenges credit you back.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl p-7 space-y-4 border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Quick scan</h3>
                <span className="text-[10px] font-mono text-sky-700 uppercase px-2 py-0.5 rounded bg-sky-50 border border-sky-200 font-semibold">
                  Fast
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-sky-600">5</span>
                <span className="text-xs font-mono text-slate-500">credits / run</span>
              </div>
              <p className="text-xs text-slate-600 pt-3 border-t border-slate-100 leading-relaxed font-normal">
                Serper + Google News · 6 accounts surfaced with verified citations
              </p>
            </div>

            <div className="rounded-2xl p-7 space-y-4 border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Standard</h3>
                <span className="text-[10px] font-mono text-indigo-700 uppercase px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-bold">
                  Popular
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-indigo-600">10</span>
                <span className="text-xs font-mono text-slate-500">credits / run</span>
              </div>
              <p className="text-xs text-slate-600 pt-3 border-t border-slate-100 leading-relaxed font-normal">
                + Tavily AI search · Apollo enrichment · 10 verified accounts
              </p>
            </div>

            <div className="rounded-2xl p-7 space-y-4 border-2 border-indigo-600 bg-white shadow-md transition-all duration-300 relative">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Deep research</h3>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                  RECOMMENDED
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-slate-900">20</span>
                <span className="text-xs font-mono text-slate-500">credits / run</span>
              </div>
              <p className="text-xs text-slate-600 pt-3 border-t border-slate-100 leading-relaxed font-normal">
                Advanced Tavily · 2-source verification · 15 verified accounts with full dossier
              </p>
            </div>
          </div>
        </section>

        {/* FOOTER (LIGHT THEME) */}
        <footer className="w-full border-t border-slate-200 py-8 px-4 sm:px-6 lg:px-8 mt-auto bg-white text-xs font-mono text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RevGenLogo className="w-5 h-5 text-indigo-600" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-900 font-bold text-sm tracking-wide">RevGen AI</span>
              </div>
              <span className="text-slate-400 hidden sm:inline">— B2B Prospecting Operating System</span>
            </div>

            <div>
              © 2026 RevGen AI · Verified B2B Account &amp; Contact Intelligence
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
