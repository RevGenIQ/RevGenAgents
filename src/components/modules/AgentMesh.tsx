"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  Sparkles,
  ShieldCheck,
  Layers,
  Clock,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Hash,
  Calendar,
  Radio,
  Cpu,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  ClientCompanyWorkspace,
  ClientIcpSubmission,
  getWorkspacesStore,
  getIcpSubmissionsStore,
  getProspectAccountsStore,
} from "@/lib/store/osWorkflowStore";
import { WorkspaceChannelHub } from "./WorkspaceChannelHub";

interface AgentMeshProps {
  workspaceId: string;
  onNavigateToResults?: () => void;
  onNavigateToIcp?: () => void;
  onNavigateToChannel?: () => void;
}

interface OrbitalNode {
  id: string;
  label: string;
  sublabel: string;
  badge?: string;
  angleDeg: number;
  ringColor: string;
  glowColor: string;
  mappedLayers: string[];
  stageSummary: string;
  approxThroughput: string;
}

// Exact 8 Orbital Nodes around ATLAS Supervisor from the reference Orchestration Graph
const ORBITAL_NODES: OrbitalNode[] = [
  {
    id: "gatekeeper",
    label: "Gatekeeper",
    sublabel: "approvals",
    angleDeg: -90, // 12 o'clock
    ringColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.22)",
    mappedLayers: ["L10", "Human QA Gate"],
    stageSummary:
      "Human Agent (Humagent) & Admin QA Gate verifying ≥3 decision-maker contacts and evidence citations before publishing to Client.",
    approxThroughput: "~5 Sample Cards (<24h) + ~35 Monthly Cards",
  },
  {
    id: "copy",
    label: "Copy",
    sublabel: "waiting",
    angleDeg: -38, // ~1:30 o'clock
    ringColor: "#14b8a6",
    glowColor: "rgba(20, 184, 166, 0.22)",
    mappedLayers: ["L7", "L10"],
    stageSummary:
      "Calibrating personalized outreach openers and executive prospect briefs grounded in dated buying triggers.",
    approxThroughput: "~3 Tailored Angles / Account",
  },
  {
    id: "deliver",
    label: "Deliver",
    sublabel: "sentinel",
    angleDeg: 12, // ~3:30 o'clock
    ringColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.22)",
    mappedLayers: ["L8", "L10"],
    stageSummary:
      "Releasing verified Account Dossiers (~5 Sample Cards within 24h max, then ~1–2 Cards/Day across the 1-Month 35-Card rollout).",
    approxThroughput: "~40 Total Verified Accounts / Month",
  },
  {
    id: "probe",
    label: "Probe",
    sublabel: "6 engines",
    angleDeg: 52, // ~5 o'clock
    ringColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.24)",
    mappedLayers: ["L1", "L2", "L3"],
    stageSummary:
      "Multi-engine discovery scanning Brave Search API, Google Career Pages, Tavily Investments, News Crawler, Official Domains & Social.",
    approxThroughput: "~1,500+ Candidate Entities Probed",
  },
  {
    id: "sentinel",
    label: "Sentinel",
    sublabel: "compliance",
    angleDeg: 90, // 6 o'clock
    ringColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.22)",
    mappedLayers: ["L2", "L8"],
    stageSummary:
      "Enforcing early DNC exclusions, existing-customer filters, canonical domain deduplication, and multi-tool email/phone verification.",
    approxThroughput: "100% DNC & Hard-Filter Enforcement",
  },
  {
    id: "score",
    label: "Score",
    sublabel: "+ Play",
    angleDeg: 135, // ~7:30 o'clock
    ringColor: "#6366f1",
    glowColor: "rgba(99, 102, 241, 0.24)",
    mappedLayers: ["L9", "L10"],
    stageSummary:
      "Computing separated ICP Fit Score, Buying Intent Score, and Evidence Confidence rubric to rank high-priority accounts.",
    approxThroughput: "Top ~10% High-Intent Accounts Ranked",
  },
  {
    id: "verify",
    label: "Verify",
    sublabel: "2-source",
    angleDeg: 180, // 9 o'clock
    ringColor: "#6366f1",
    glowColor: "rgba(99, 102, 241, 0.24)",
    mappedLayers: ["L6", "L8", "L9"],
    stageSummary:
      "Cross-checking every buying signal across at least 2 independent sources with publication dates and direct URLs.",
    approxThroughput: "2-Source Evidence Cross-Check",
  },
  {
    id: "signal",
    label: "Signal",
    sublabel: "100+ · 10 layers",
    badge: "2",
    angleDeg: -140, // ~10:30 o'clock
    ringColor: "#6366f1",
    glowColor: "rgba(99, 102, 241, 0.28)",
    mappedLayers: ["L1", "L3", "L4", "L5", "L6", "L7", "L9"],
    stageSummary:
      "Correlating raw observations across 100+ sources and all 10 intelligence layers into named, dated buying triggers.",
    approxThroughput: "~100+ Signal Sources Correlated",
  },
];

const ECOSYSTEM_LAYERS = [
  {
    code: "L1",
    title: "Professional Networks",
    subtitle: "the who",
    description:
      "Decision-maker discovery · org mapping · job changes · hiring managers · growth trajectories",
    pills: [
      "LINKEDIN",
      "SALES NAV",
      "CRUNCHBASE",
      "APOLLO",
      "ZOOMINFO",
      "ROCKETREACH",
      "LUSHA",
      "COGNISM",
      "SEAMLESS.AI",
      "LEADIQ",
    ],
  },
  {
    code: "L2",
    title: "Company Intelligence",
    subtitle: "the what",
    description:
      "Deep-crawled from the company's own web estate — revenue indicators, headcount, products, leadership, locations",
    pills: [
      "OFFICIAL SITE",
      "LEADERSHIP PAGES",
      "INVESTOR RELATIONS",
      "PRODUCT & PARTNERS",
      "CAREERS",
      "PRESS CENTRE",
    ],
  },
  {
    code: "L3",
    title: "Hiring Intelligence",
    subtitle: "plans, in public",
    description:
      "A job description is a company announcing its roadmap in public — transformation programs, expansion, new departments",
    pills: [
      "LINKEDIN JOBS",
      "GREENHOUSE",
      "LEVER",
      "WORKDAY",
      "SMARTRECRUITERS",
      "ASHBY",
      "INDEED",
    ],
  },
  {
    code: "L4",
    title: "Funding & Investment",
    subtitle: "budgets unlocked",
    description:
      "Series A–E · private equity · acquisitions · IPO prep · expansion — capital events that unlock budgets",
    pills: [
      "CRUNCHBASE",
      "TRACXN",
      "PITCHBOOK",
      "CB INSIGHTS",
      "VENTURE INTELLIGENCE",
      "YC LISTS",
    ],
  },
  {
    code: "L5",
    title: "Technology Intelligence",
    subtitle: "displacement windows",
    description:
      "Full stack detection — CRM, cloud, ERP, HRMS, analytics — including migrations in progress",
    pills: [
      "BUILTWITH",
      "WAPPALYZER",
      "SIMILARTECH",
      "HG INSIGHTS",
      "DATANYZE",
    ],
  },
  {
    code: "L6",
    title: "News & Business Events",
    subtitle: "why now, dated",
    description:
      "Partnerships, launches, leadership changes, M&A — dated, citable events that time the outreach with source links",
    pills: [
      "GOOGLE NEWS",
      "PRESS RELEASES",
      "PR NEWSWIRE",
      "BUSINESS WIRE",
      "BLOOMBERG",
      "REUTERS",
    ],
  },
  {
    code: "L7",
    title: "Social Intelligence",
    subtitle: "first-hand voices",
    description:
      "Executives describing their own pain — supplying outreach language in the buyer's own words",
    pills: [
      "LINKEDIN POSTS",
      "X",
      "YOUTUBE",
      "MEDIUM",
      "GITHUB",
      "PODCASTS",
      "INTERVIEWS",
    ],
  },
  {
    code: "L8",
    title: "Contact Verification",
    subtitle: "trust, enforced",
    description:
      "Multi-tool cross-checks before any contact ships; direct emails, phone validation, and human QA",
    pills: [
      "NEVERBOUNCE",
      "ZEROBOUNCE",
      "BOUNCER",
      "EMAILABLE",
      "MILLIONVERIFIER",
      "CARRIER VALIDATION",
    ],
  },
];

export function AgentMesh({
  workspaceId,
  onNavigateToResults,
  onNavigateToIcp,
  onNavigateToChannel,
}: AgentMeshProps) {
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState<ClientCompanyWorkspace | null>(
    null
  );
  const [icpBrief, setIcpBrief] = useState<ClientIcpSubmission | null>(null);
  const [deliveredCount, setDeliveredCount] = useState<number>(0);

  // Interactive ATLAS Node & L1–L10 Live Layer Animation State
  const [selectedNodeId, setSelectedNodeId] = useState<string>("signal");
  const [activeLayerIdx, setActiveLayerIdx] = useState<number>(0); // 0..9 corresponding to L1..L10
  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const [scanTick, setScanTick] = useState<number>(0);

  useEffect(() => {
    const syncStore = () => {
      const wsList = getWorkspacesStore();
      const myWs =
        wsList.find((w) => w.id === workspaceId) || wsList[0] || null;
      setWorkspace(myWs);

      const icps = getIcpSubmissionsStore();
      const myIcp =
        icps.find((i) => i.workspaceId === (myWs?.id || workspaceId)) ||
        icps[0] ||
        null;
      setIcpBrief(myIcp);

      const accs = getProspectAccountsStore().filter(
        (a) =>
          (!myWs || a.workspaceId === myWs.id) &&
          a.stage === "published_to_client"
      );
      setDeliveredCount(accs.length);
    };

    syncStore();
    window.addEventListener("revgen-os-store-update", syncStore);
    return () =>
      window.removeEventListener("revgen-os-store-update", syncStore);
  }, [workspaceId]);

  // Dynamic L1–L10 & ATLAS Orbital Scan Loop
  useEffect(() => {
    if (!isAnimating) return;
    const timer = setInterval(() => {
      setScanTick((t) => t + 1);
      setActiveLayerIdx((prev) => (prev + 1) % 10);
      setSelectedNodeId((prevId) => {
        const idx = ORBITAL_NODES.findIndex((n) => n.id === prevId);
        return ORBITAL_NODES[(idx + 1) % ORBITAL_NODES.length].id;
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [isAnimating]);

  const activeNode =
    ORBITAL_NODES.find((n) => n.id === selectedNodeId) || ORBITAL_NODES[7];
  const currentLayerCode = `L${activeLayerIdx + 1}`;
  const channelName =
    workspace?.channelName ||
    `RevGenAIx${(workspace?.companyName || user?.companyName || "Client").replace(
      /[^a-zA-Z0-9]/g,
      ""
    )}`;

  // Geometry for SVG Orchestration Graph (center at 320, 230, radius 165)
  const cx = 320;
  const cy = 230;
  const radius = 162;

  const computedNodes = ORBITAL_NODES.map((node) => {
    const rad = (node.angleDeg * Math.PI) / 180;
    return {
      ...node,
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  });

  // Outer perimeter connections matching the uploaded screenshot:
  // Signal -> Verify -> Score, Copy -> Deliver
  const findNode = (id: string) =>
    computedNodes.find((n) => n.id === id) || computedNodes[0];

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto text-left">
      {/* ════════════════ SECTION 1: DELIVERY SLA & ICP SEARCH STATUS BANNER ════════════════ */}
      <div className="rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--line2)]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                ATLAS Supervision · Active Layer: {currentLayerCode}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                <Clock className="w-3.5 h-3.5" />
                ~5 Samples: &lt;24h Max SLA · Next ~35 Cards: 1-Month Span
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text)] tracking-tight">
              Centralized Agent Mesh Supervision &amp; 10-Layer Intelligence Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text2)] max-w-3xl leading-relaxed">
              {icpBrief
                ? `Actively executing your ICP Brief ("${icpBrief.offering}") across ${icpBrief.targetIndustries.join(
                    ", "
                  )} in ${icpBrief.geographies.join(
                    ", "
                  )}. First ~5 verified sample accounts are delivered within 24 hours max, followed by ~35 verified cards over 1 month.`
                : "ATLAS Supervisor is standing by and scanning live B2B intent layers. Submit or upgrade your ICP Brief anytime to calibrate your ~5 sample cards (<24h max) and ~35 monthly cards."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAnimating((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isAnimating ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pause Live Pulse</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Resume Live Pulse</span>
                </>
              )}
            </button>

            {onNavigateToIcp && (
              <button
                type="button"
                onClick={onNavigateToIcp}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--line2)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Upgrade ICP Criteria</span>
              </button>
            )}

            {onNavigateToResults && (
              <button
                type="button"
                onClick={onNavigateToResults}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Account Intelligence ({deliveredCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3-Card Delivery Cadence & Channel SLA Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-indigo-600 dark:text-indigo-400 font-bold">
              <span>BATCH 1 · CALIBRATION SAMPLES</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm font-extrabold text-[var(--text)]">
              ~5 Verified Sample Cards · &lt;24 Hours Max
            </div>
            <p className="text-[11px] text-[var(--text2)] leading-relaxed">
              Human-verified with ~3+ decision-makers per account so you can validate fit and request ICP adjustments.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-bold">
              <span>BATCH 2 · MONTHLY PRODUCTION</span>
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm font-extrabold text-[var(--text)]">
              ~35 Verified Account Cards · 1-Month Span
            </div>
            <p className="text-[11px] text-[var(--text2)] leading-relaxed">
              Steady delivery (~1–2 cards/day over ~30 days) with full source evidence and PDF/CSV export.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-indigo-600 dark:text-indigo-400 font-bold">
              <span>DEDICATED WORKSPACE CHANNEL</span>
              <Hash className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm font-extrabold text-[var(--text)] font-mono">
              #{channelName}
            </div>
            <p className="text-[11px] text-[var(--text2)] leading-relaxed">
              All sample feedback, ICP upgrades, Google Meet calls, negotiations, and payment/payout milestones happen in your channel below.
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════ SECTION 2: INTERACTIVE ATLAS ORCHESTRATION GRAPH (MATCHING REFERENCE SCREENSHOT) ════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: The Radial Orchestration Graph Canvas */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0b0d19] border border-indigo-500/30 p-6 text-white shadow-lg flex flex-col justify-between relative overflow-hidden">
          {/* Subtle radial background glow matching screenshot */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 54%, rgba(99, 102, 241, 0.22) 0%, rgba(15, 23, 42, 0.05) 60%, transparent 100%)",
            }}
          />

          {/* Top Bar: "● Orchestration graph" & "click a node to inspect" */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              <span className="text-base font-bold tracking-tight text-slate-100">
                Orchestration graph
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              click a node to inspect
            </span>
          </div>

          {/* Interactive SVG Radial Graph */}
          <div className="relative z-10 w-full flex items-center justify-center my-2">
            <svg
              viewBox="0 0 640 460"
              className="w-full max-w-[620px] h-auto select-none"
            >
              <defs>
                <radialGradient id="atlasCenterGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4338ca" />
                </radialGradient>
              </defs>

              {/* Outer Perimeter Subtle Connectors (matching screenshot: Signal -> Verify -> Score, Copy -> Deliver) */}
              <line
                x1={findNode("signal").x}
                y1={findNode("signal").y}
                x2={findNode("verify").x}
                y2={findNode("verify").y}
                stroke="rgba(99, 102, 241, 0.35)"
                strokeWidth="1.5"
              />
              <line
                x1={findNode("verify").x}
                y1={findNode("verify").y}
                x2={findNode("score").x}
                y2={findNode("score").y}
                stroke="rgba(99, 102, 241, 0.35)"
                strokeWidth="1.5"
              />
              <line
                x1={findNode("copy").x}
                y1={findNode("copy").y}
                x2={findNode("deliver").x}
                y2={findNode("deliver").y}
                stroke="rgba(20, 184, 166, 0.35)"
                strokeWidth="1.5"
              />

              {/* Dashed Radial Spokes from ATLAS Center to Each Orbital Node */}
              {computedNodes.map((node) => {
                const isSelected = node.id === selectedNodeId;
                return (
                  <g key={`spoke-${node.id}`}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={node.x}
                      y2={node.y}
                      stroke={node.ringColor}
                      strokeOpacity={isSelected ? 0.9 : 0.45}
                      strokeWidth={isSelected ? "2.2" : "1.5"}
                      strokeDasharray="6 6"
                    />
                    {isSelected && (
                      <circle
                        cx={(cx + node.x) / 2}
                        cy={(cy + node.y) / 2}
                        r="3.5"
                        fill={node.ringColor}
                      >
                        <animate
                          attributeName="cx"
                          from={cx}
                          to={node.x}
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="cy"
                          from={cy}
                          to={node.y}
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Center Hub: ATLAS Supervisor */}
              <g
                onClick={() => setSelectedNodeId("signal")}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r="64"
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.25)"
                  strokeWidth="1.2"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="55"
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.45)"
                  strokeWidth="1.5"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="46"
                  fill="url(#atlasCenterGrad)"
                  stroke="#818cf8"
                  strokeWidth="2"
                />
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="15"
                  fontWeight="800"
                  letterSpacing="0.06em"
                >
                  ATLAS
                </text>
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  fill="#e0e7ff"
                  fontSize="11"
                  fontWeight="500"
                >
                  Supervisor
                </text>
              </g>

              {/* 8 Orbital Nodes */}
              {computedNodes.map((node) => {
                const isSelected = node.id === selectedNodeId;
                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setIsAnimating(false);
                    }}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="42"
                        fill={node.glowColor}
                        stroke={node.ringColor}
                        strokeOpacity="0.5"
                        strokeWidth="1.5"
                      />
                    )}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="34"
                      fill="#111528"
                      stroke={node.ringColor}
                      strokeWidth={isSelected ? "2.5" : "1.6"}
                    />
                    <text
                      x={node.x}
                      y={node.y - 3}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="11.5"
                      fontWeight="700"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 12}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="9.5"
                      fontWeight="500"
                    >
                      {node.sublabel}
                    </text>

                    {/* Badge (e.g., "2" on Signal node from screenshot) */}
                    {node.badge && (
                      <g>
                        <circle
                          cx={node.x}
                          cy={node.y - 34}
                          r="10"
                          fill="#1e1b4b"
                          stroke="#f59e0b"
                          strokeWidth="1.6"
                        />
                        <text
                          x={node.x}
                          y={node.y - 30.5}
                          textAnchor="middle"
                          fill="#f8fafc"
                          fontSize="10"
                          fontWeight="800"
                        >
                          {node.badge}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Graph Footer */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase text-indigo-400 font-bold">
                Active Node:
              </span>
              <span className="font-bold text-white">
                ATLAS → {activeNode.label} ({activeNode.sublabel})
              </span>
            </div>
            <div className="font-mono text-xs text-emerald-400">
              Scanning Layer {currentLayerCode} · {activeNode.approxThroughput}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Live Node & Layer Telemetry Inspector */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg2)] border border-[var(--line2)] p-6 flex flex-col justify-between space-y-5 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line2)] pb-3.5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
                  NODE TELEMETRY INSPECTOR · LIVE ICP EXECUTION
                </span>
                <h2 className="text-lg font-extrabold text-[var(--text)] mt-0.5">
                  ATLAS · {activeNode.label} Agent ({activeNode.sublabel})
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                {activeNode.mappedLayers.join(" · ")}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg3)] border border-[var(--line2)] space-y-2">
              <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                WHAT THIS AGENT IS DOING RIGHT NOW
              </div>
              <p className="text-xs text-[var(--text)] leading-relaxed font-medium">
                {activeNode.stageSummary}
              </p>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                <span>Estimated Throughput:</span>
                <strong>{activeNode.approxThroughput}</strong>
              </div>
            </div>

            {/* Live Stage Checklist */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase text-[var(--text3)] font-bold">
                ALL 8 ATLAS SUPERVISION NODES (CLICK TO INSPECT)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ORBITAL_NODES.map((n) => {
                  const isSel = n.id === selectedNodeId;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(n.id);
                        setIsAnimating(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSel
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border-[var(--line2)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">
                          {n.label}
                        </div>
                        <div
                          className={`text-[10px] truncate ${
                            isSel ? "text-indigo-100" : "text-[var(--text3)]"
                          }`}
                        >
                          {n.sublabel}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isSel
                            ? "bg-white/20 text-white"
                            : "bg-[var(--bg2)] text-[var(--text2)]"
                        }`}
                      >
                        {n.mappedLayers[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Inspector SLA Footer */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="text-xs text-[var(--text)]">
              <strong>Live Search Layer:</strong>{" "}
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                {currentLayerCode}
              </span>{" "}
              · Sample Batch ETA: <strong>&lt;24h Max</strong>
            </div>
            {onNavigateToIcp && (
              <button
                type="button"
                onClick={onNavigateToIcp}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
              >
                Upgrade ICP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ SECTION 3: DYNAMIC ANIMATED L1–L10 INTELLIGENCE ECOSYSTEM (LIGHT & DARK MODE READY) ════════════════ */}
      <div className="rounded-3xl bg-[var(--bg2)] border border-[var(--line2)] p-6 lg:p-8 text-[var(--text)] shadow-sm space-y-6">
        {/* Top Pipeline Flow Banner */}
        <div className="p-4 rounded-2xl bg-[var(--bg3)] border border-[var(--line2)] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
              <div className="text-xs font-mono font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400">
                LAYERS 1–8 · COLLECT ({currentLayerCode} ACTIVE)
              </div>
            </div>
            <div className="text-[11px] text-[var(--text2)]">
              ~100+ live sources scanned in parallel
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text3)] hidden sm:block" />
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-extrabold tracking-wider text-amber-600 dark:text-amber-400">
              LAYER 9 · CORRELATE
            </div>
            <div className="text-[11px] text-[var(--text2)]">
              Observations → named, dated buying signals
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text3)] hidden sm:block" />
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-extrabold tracking-wider text-sky-600 dark:text-sky-400">
              LAYER 10 · REASON
            </div>
            <div className="text-[11px] text-[var(--text2)]">
              Agents score, rank &amp; draft briefs
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text3)] hidden sm:block" />
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400">
              HUMAGENT QA GATE → CLIENT QUEUE
            </div>
            <div className="text-[11px] text-[var(--text2)]">
              ~5 Samples (&lt;24h) + ~35 Cards / Month
            </div>
          </div>
        </div>

        {/* Live Animated L1–L10 Progress Strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-bold text-[var(--text2)] uppercase">
              LIVE LAYER SCANNING SEQUENCE:
            </span>
            <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
              Currently Active: Layer {currentLayerCode} · Pulse #{scanTick + 1}
            </span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 10 }).map((_, idx) => {
              const code = `L${idx + 1}`;
              const isCurrent = idx === activeLayerIdx;
              const isPassed = idx < activeLayerIdx;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setActiveLayerIdx(idx);
                    setIsAnimating(false);
                  }}
                  className={`py-2 px-2 rounded-xl font-mono text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    isCurrent
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.03]"
                      : isPassed
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-[var(--bg3)] text-[var(--text2)] border-[var(--line2)]"
                  }`}
                >
                  <span>{code}</span>
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid of Layers L1 through L8 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ECOSYSTEM_LAYERS.map((layer, idx) => {
            const isLayerActive = activeLayerIdx === idx;
            return (
              <div
                key={layer.code}
                onClick={() => {
                  setActiveLayerIdx(idx);
                  setIsAnimating(false);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                  isLayerActive
                    ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
                    : "bg-[var(--bg3)] border-[var(--line2)] hover:border-indigo-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-xs font-extrabold border ${
                        isLayerActive
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                      }`}
                    >
                      {layer.code}
                    </span>
                    <h3 className="text-sm font-extrabold text-[var(--text)]">
                      {layer.title}
                    </h3>
                    {isLayerActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        SCANNING NOW
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text3)]">
                    {layer.subtitle}
                  </span>
                </div>

                <p className="text-xs text-[var(--text2)] leading-relaxed">
                  {layer.description}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {layer.pills.map((pill) => (
                    <span
                      key={pill}
                      className={`px-2.5 py-1 rounded-md border font-mono text-[10px] font-bold tracking-wide transition-colors ${
                        isLayerActive
                          ? "bg-[var(--bg2)] border-indigo-500/40 text-indigo-600 dark:text-indigo-300"
                          : "bg-[var(--bg2)] border-[var(--line2)] text-[var(--text2)]"
                      }`}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Regional Data Spine + L9 Intent & Buying Signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Regional & Registry Data Spine */}
          <div className="p-5 rounded-2xl bg-[var(--bg3)] border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-extrabold">
                  ✦
                </span>
                <h3 className="text-sm font-extrabold text-[var(--text)]">
                  Enterprise &amp; Regional Registry Spine
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                configured per ICP
              </span>
            </div>

            <p className="text-xs text-[var(--text2)] leading-relaxed">
              Authoritative corporate filings, GST/MCA/SEC registries, industrial directories, and exchange announcements where global databases go thin.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "MCA",
                "GST",
                "SEC EDGAR",
                "UDYAM",
                "EPFO",
                "NAUKRI",
                "INDIAMART",
                "BSE/NSE",
                "REGIONAL PRESS",
              ].map((pill) => (
                <span
                  key={pill}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg2)] border border-[var(--line2)] font-mono text-[10px] text-[var(--text2)] font-bold"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* L9: Intent & Buying Signals */}
          <div
            onClick={() => {
              setActiveLayerIdx(8);
              setIsAnimating(false);
            }}
            className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
              activeLayerIdx === 8
                ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
                : "bg-[var(--bg3)] border-indigo-500/35"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-xs font-extrabold">
                  L9
                </span>
                <h3 className="text-sm font-extrabold text-[var(--text)]">
                  Intent &amp; Buying Signals — where the layers converge
                </h3>
              </div>
              {activeLayerIdx === 8 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                  CORRELATING NOW
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--text2)] leading-relaxed">
              Raw observations from Layers 1–8 are correlated into named, evidence-backed signals. Every signal names the layers it fired in, the evidence URL, and the date.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 font-mono text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">
                Hiring spikes
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                Budget expansion
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 font-mono text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                Geographic expansion
              </span>
              <span className="px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 font-mono text-[10px] text-rose-700 dark:text-rose-300 font-bold">
                Executive hiring
              </span>
              <span className="px-2.5 py-1 rounded-md bg-sky-500/15 border border-sky-500/30 font-mono text-[10px] text-sky-700 dark:text-sky-300 font-bold">
                Technology migration
              </span>
            </div>
          </div>
        </div>

        {/* L10: The AI Research Layer & Human QA Gate */}
        <div
          onClick={() => {
            setActiveLayerIdx(9);
            setIsAnimating(false);
          }}
          className={`p-6 rounded-2xl border transition-all cursor-pointer space-y-4 ${
            activeLayerIdx === 9
              ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
              : "bg-[var(--bg3)] border-indigo-500/30"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-xs font-extrabold">
                L10
              </span>
              <h3 className="text-base font-extrabold text-[var(--text)]">
                The AI Research Layer &amp; Humagent QA Gate — agents reason, humans verify
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                verified
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                inference
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold">
                human-approved
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
            {[
              [
                "Research accounts",
                "full-depth investigation across every layer (L1–L9)",
              ],
              [
                "Identify buying triggers",
                "timed, evidence-backed correlations with source URLs",
              ],
              [
                "Prioritise & score",
                "fit-scored tiers (~5 Sample Cards <24h + ~35 Monthly Cards)",
              ],
              [
                "Personalised outreach angles",
                "built on the account's own verified trigger & pain point",
              ],
              [
                "Draft prospect summaries",
                "the account's story in one executive brief, sources attached",
              ],
              [
                "Humagent QA gate",
                "assigned Human Agent verifies ≥3 decision-maker contacts before release",
              ],
            ].map(([left, right]) => (
              <div
                key={left}
                className="flex items-center justify-between py-2 border-b border-[var(--line2)] gap-4"
              >
                <span className="font-bold text-[var(--text)]">{left}</span>
                <span className="text-[var(--text2)] text-right">{right}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════ SECTION 4: EMBEDDED REAL-TIME WORKSPACE COLLABORATION CHANNEL ════════════════ */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
              LIVE CAMPAIGN &amp; DELIVERY COLLABORATION CHANNEL
            </span>
            <h2 className="text-lg font-extrabold text-[var(--text)]">
              Workspace Channel #{channelName} (Client + Humagent + Admin Supervisor)
            </h2>
          </div>
        </div>

        <WorkspaceChannelHub
          role="client"
          currentUserEmail={user?.email || ""}
          currentUserName={user?.fullName || user?.companyName || "Client"}
          lockedWorkspaceId={workspace?.id || workspaceId}
          onUpgradeIcpClick={onNavigateToIcp}
          compactHeight
        />
      </div>
    </div>
  );
}
