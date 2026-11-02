"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Building,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Mail,
  Copy,
  ChevronRight,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  Check,
} from "lucide-react";
import { Company, Contact, Signal, Dossier } from "@/lib/supabase/types";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";

interface AccountDossierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  workspaceId?: string;
  onOpenCopyLab: () => void;
  onOpenCollab?: (
    accountName?: string,
    mode?: "shared" | "correction_request" | "internal_note"
  ) => void;
}

// Section Error Boundary to safely isolate rendering failures per section
interface SafeSectionProps {
  title?: string;
  children: React.ReactNode;
}
interface SafeSectionState {
  hasError: boolean;
  error?: Error;
}
class SafeSection extends React.Component<SafeSectionProps, SafeSectionState> {
  constructor(props: SafeSectionProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[AccountDossierDrawer] Error in section "${this.props.title || "Section"}":`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            Could not render this section ({this.props.title || "Section"})
          </div>
          <p className="text-[11px] text-[var(--ink3)]">
            An unexpected data format was encountered and safely isolated. Other sections remain functional.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Safe parsing utilities
function safeString(val: any, fallback: string = "Not available"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return fallback;
}

function safeNumber(val: any, fallback: number = 0): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  }
  if (typeof val === "object" && val !== null) {
    if (typeof val.contribution === "number") return val.contribution;
    if (typeof val.score === "number") return val.score;
  }
  return fallback;
}

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function safeObject(val: any): Record<string, any> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

function isPrimarySource(urlStr: string, sourceName?: string): boolean {
  const norm = (urlStr || "").toLowerCase();
  const nameNorm = (sourceName || "").toLowerCase();

  if (nameNorm.includes("nse") || nameNorm.includes("bse") || nameNorm.includes("tender") || nameNorm.includes("press release")) {
    return true;
  }
  if (norm.includes("nseindia.com") || norm.includes("bseindia.com") || norm.includes(".gov.bd") || norm.includes(".gov.in")) {
    return true;
  }
  const companyDomains = [
    "marutisuzuki.com", "tatamotors.com", "heromotocorp.com", "honda2wheelersindia.com",
    "hondacarindia.com", "hal-india.co.in", "ashokleyland.com", "jbmgroup.com",
    "tataadvancedsystems.com", "suzukimotorcycle.co.in", "escortskubota.com",
    "ideaforgetech.com", "datapatternsindia.com", "zentechnologies.com",
    "adanidefence.com", "sonalika.com", "smpp.com", "fibrain.com", "corning.com",
    "dynamatics.com", "yamaha-motor-india.com", "jcb.com", "tfkable.com", "solargroup.com",
    "global.honda", "globalsuzuki.com"
  ];
  return companyDomains.some((d) => norm.includes(d));
}

export function AccountDossierDrawer({
  isOpen,
  onClose,
  companyName,
  workspaceId = "",
  onOpenCopyLab,
  onOpenCollab,
}: AccountDossierDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeReason, setChallengeReason] = useState("Wrong-fit buyer persona");
  const [challengeSuccess, setChallengeSuccess] = useState<string | null>(null);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);

  // Outreach Draft Generator State
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [draftSourceUrl, setDraftSourceUrl] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  useEffect(() => {
    if (!isOpen || !companyName) return;

    let isMounted = true;
    setLoading(true);
    setGeneratedDraft(null);
    setDraftSourceUrl(null);
    setCopiedDraft(false);

    async function loadDossierData() {
      try {
        // 1. Search company (pass workspaceId if present)
        const primarySearch = companyName.split("(")[0].trim();
        const compUrl = `/api/companies?${workspaceId ? `workspaceId=${encodeURIComponent(workspaceId)}&` : ""}search=${encodeURIComponent(primarySearch || companyName)}&limit=10`;
        const compRes = await fetch(compUrl);
        let foundCompany: Company | null = null;
        if (compRes.ok) {
          const compData = await compRes.json();
          if (compData.companies && compData.companies.length > 0) {
            const targetLower = companyName.toLowerCase();
            const primaryLower = primarySearch.toLowerCase();
            foundCompany =
              compData.companies.find(
                (c: Company) =>
                  c.company_name?.toLowerCase() === targetLower ||
                  c.company_name?.toLowerCase().includes(primaryLower) ||
                  targetLower.includes(c.company_name?.toLowerCase() || "")
              ) || compData.companies[0];
          }
        }

        if (!isMounted) return;

        if (foundCompany) {
          setCompany(foundCompany);
          const effectiveWs = foundCompany.workspace_id || workspaceId;

          // 2. Fetch company's dossier
          let loadedDossier: Dossier | null = null;
          const dosRes = await fetch(
            `/api/dossiers?workspaceId=${effectiveWs}&companyId=${foundCompany.id}`
          );
          if (dosRes.ok) {
            const dosData = await dosRes.json();
            if (dosData.dossiers && dosData.dossiers.length > 0) {
              loadedDossier = dosData.dossiers[0];
            }
          }
          setDossier(loadedDossier);

          // 3. Fetch contacts by companyId (exact), fallback to search
          let loadedContacts: Contact[] = [];
          const contRes = await fetch(
            `/api/contacts?workspaceId=${effectiveWs}&companyId=${foundCompany.id}&limit=100`
          );
          if (contRes.ok) {
            const contData = await contRes.json();
            loadedContacts = contData.contacts || [];
          }
          if (loadedContacts.length === 0 && foundCompany.company_name) {
            const fallbackRes = await fetch(
              `/api/contacts?workspaceId=${effectiveWs}&search=${encodeURIComponent(foundCompany.company_name)}&limit=100`
            );
            if (fallbackRes.ok) {
              const fbData = await fallbackRes.json();
              loadedContacts = fbData.contacts || [];
            }
          }
          setContacts(loadedContacts);

          // 4. Fetch signals
          let loadedSignals: Signal[] = [];
          const sigRes = await fetch(
            `/api/signals?workspaceId=${effectiveWs}&limit=50`
          );
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            const targetCompLower = (companyName || "").toLowerCase();
            loadedSignals = (sigData.signals || []).filter(
              (s: Signal) =>
                s.company_id === foundCompany?.id ||
                (s.company_name && s.company_name.toLowerCase().includes(targetCompLower))
            );
          }
          setSignals(loadedSignals);
        } else {
          setCompany(null);
          setDossier(null);
          setContacts([]);
          setSignals([]);
        }
      } catch (err) {
        console.error("Error loading account dossier:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDossierData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, companyName, workspaceId]);

  if (!isOpen) return null;

  // Safe object extractions
  const techObj = safeObject(company?.company_technologies);
  const breakdownObj = safeObject(dossier?.icp_score_breakdown);

  // Origin determination
  const isImported =
    String(company?.icp_fit_reason || "").includes("imported research") ||
    String(dossier?.summary || "").includes("imported research") ||
    techObj.source === "analyst_import" ||
    techObj.dataset === "HDL_HFCL_2026-10-20" ||
    Boolean(techObj.segment) ||
    Boolean(techObj.hdl_product_line);

  // Sorting contacts: Best entry contact appears FIRST
  const bestEntryRaw = safeString(techObj.best_entry_contact || breakdownObj.best_entry_contact, "");
  const sortedContacts = [...contacts].sort((a, b) => {
    if (!bestEntryRaw) return 0;
    const aMatch =
      bestEntryRaw.toLowerCase().includes((a.first_name || "").toLowerCase()) ||
      bestEntryRaw.toLowerCase().includes((a.last_name || "").toLowerCase()) ||
      (a.title && bestEntryRaw.toLowerCase().includes(a.title.toLowerCase()));
    const bMatch =
      bestEntryRaw.toLowerCase().includes((b.first_name || "").toLowerCase()) ||
      bestEntryRaw.toLowerCase().includes((b.last_name || "").toLowerCase()) ||
      (b.title && bestEntryRaw.toLowerCase().includes(b.title.toLowerCase()));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });

  const targetContact = sortedContacts[0];

  // Curated signals from account-sheet + signal log merged & deduplicated by URL/title
  const curatedFromTech = safeArray(techObj.signals_curated).map((s: any) => ({
    id: `curated-${s.rank || Math.random()}`,
    title: s.text || "Signal",
    supporting_excerpt: s.text || "",
    event_date: s.date || "Recent",
    publication_date: s.date || "Recent",
    evidence_url: s.source || "",
    confidence: 0.9,
    source_layer: isPrimarySource(s.source || "") ? "Primary" : "Secondary",
    explanation: `Source: ${s.source || "Analyst Research"}`,
  }));

  const allSignals = [...signals];
  for (const cs of curatedFromTech) {
    if (!allSignals.some((s) => (s.evidence_url && s.evidence_url === cs.evidence_url) || s.title === cs.title)) {
      allSignals.push(cs as any);
    }
  }

  // Generate deterministic email draft using ONLY stored fields (Step 3)
  const handleGenerateDraft = () => {
    const topSignal = allSignals[0];
    const bestContact = sortedContacts[0];
    const companyDisplayName = company?.company_name || companyName;
    const isExtrieve = Boolean(
      techObj.dataset === "EXTRIEVE_BFSI_2026-10-28" ||
      techObj.seller_company === "Extrieve" ||
      String(company?.icp_fit_reason || "").includes("EXTRIEVE_BFSI_2026-10-28")
    );
    const seller = isExtrieve ? "Extrieve" : safeString(techObj.seller_company, "HTL Ltd (HFCL Group)");
    const productLine = safeString(
      techObj.recommended_extrieve_product || techObj.product_line || techObj.hdl_product_line,
      isExtrieve ? "document automation & AI workflow processing" : "wire harness & interconnect solutions"
    );
    const outreachAngle = safeString(techObj.outreach_angle || dossier?.recommended_opener, `Operational scaling with ${companyDisplayName}`);
    const contactSalutation = bestContact?.first_name ? `Hi ${bestContact.first_name},` : "Hi Leadership Team,";
    const signalSentence = topSignal
      ? `Noticed ${companyDisplayName}'s recent milestone: "${topSignal.supporting_excerpt || topSignal.title}" (${topSignal.event_date || topSignal.publication_date || "Recent"}).`
      : `Following ${companyDisplayName}'s operational manufacturing initiatives.`;

    const draftText = isExtrieve
      ? `${contactSalutation}

${signalSentence}

Given your focus on ${outreachAngle.toLowerCase()}, Extrieve provides qualified document modernization, SplicerAI SDK, and CKYC/DMS solutions. We help financial institutions accelerate processing TAT and ensure regulatory compliance.

Would you be open to reviewing our technical solution overview and banking automation brief?

Best regards,
Extrieve Team`
      : `${contactSalutation}

${signalSentence}

Given your focus on ${outreachAngle.toLowerCase()}, ${seller} has established qualified manufacturing lines supporting ${productLine}. We help tier-1 OEMs and systems integrators compress qualification cycles and secure localized supply.

Would you be open to reviewing our technical spec sheet and North India capacity brief?

Best regards,
${seller}`;

    setGeneratedDraft(draftText);
    setDraftSourceUrl(topSignal?.evidence_url || null);
    setCopiedDraft(false);
  };

  const handleCopyDraft = () => {
    if (generatedDraft) {
      navigator.clipboard.writeText(generatedDraft);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account Dossier drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-[var(--bg-card)] border-l border-[var(--line2)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[var(--line)] flex items-start justify-between bg-[var(--bg-card)]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20 font-bold">
                {safeString(techObj.priority || dossier?.priority_tier, "P1 PRIORITY")}
              </span>
              <span className="text-xs text-emerald-500 font-mono font-semibold">
                Buying Window: {safeString(techObj.buying_window || (dossier?.buying_window_days ? `${dossier.buying_window_days} days` : "30-60 days"), "30-60 days")}
              </span>
              {/* Origin Badge */}
              {isImported ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold uppercase">
                  Imported Research
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Live Run
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <CompanyFavicon domain={company?.canonical_domain || company?.domain} name={company?.company_name || companyName} size="w-8 h-8" />
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)] leading-snug">
                  {company?.company_name || companyName}
                </h2>
                <p className="text-xs text-[var(--ink3)] font-mono">
                  {company?.canonical_domain || "Domain pending"} · {safeString(company?.company_city || company?.city, "India")}, {safeString(techObj.country || company?.company_country || company?.country, "India")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const targetId = company?.id || companyName;
                const url = `/card/${encodeURIComponent(targetId)}?campaign=${encodeURIComponent(techObj?.dataset || "Account Dossier")}`;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="px-3 py-1.5 rounded-xl bg-brand/15 hover:bg-brand text-brand hover:text-white border border-brand/30 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Open A4 Account Delivery Card in new tab"
            >
              <FileText className="w-3.5 h-3.5" />
              Export card
            </button>

            {onOpenCollab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCollab(company?.company_name || companyName, "correction_request");
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                title="Request correction or ask a question about this account"
              >
                <span>Request Correction</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--line2)] text-[var(--ink3)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-[var(--ink3)]">Fetching live dossier from database...</p>
            </div>
          ) : !company && !dossier ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-8 h-8 text-[var(--ink3)] mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-[var(--ink)]">No Dossier Compiled Yet</h3>
              <p className="text-xs text-[var(--ink3)] max-w-sm mx-auto mt-1 mb-4">
                No active records found for <strong>{companyName}</strong> in this workspace.
              </p>
            </div>
          ) : isImported ? (
            /* ========================================================================= */
            /* IMPORTED RESEARCH CARD VIEW (PART 3)                                      */
            /* ========================================================================= */
            <>
              {/* Header Stats Grid */}
              <SafeSection title="Header & Fit Scores">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-[var(--glass)] border border-[var(--line)]">
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Segment</span>
                    <div className="text-xs font-semibold text-[var(--ink)] mt-0.5 truncate" title={techObj.segment}>
                      {safeString(techObj.segment || company?.industry, "Automotive / Defence OEM")}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Fit (P/G/S)</span>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                      {safeNumber(techObj.fit_product_match ?? breakdownObj.product_match, 0)}/{safeNumber(techObj.fit_geography ?? breakdownObj.geography_match, 0)}/{safeNumber(techObj.fit_scale_volume ?? breakdownObj.scale_volume, 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Fit / Intent</span>
                    <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">
                      {safeNumber(techObj.icp_fit_score ?? 100, 100)} / {safeNumber(techObj.intent_score ?? breakdownObj.intent_score, 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Account Score</span>
                    <div className="text-xs font-mono font-extrabold text-brand mt-0.5">
                      {safeNumber(techObj.account_score ?? company?.icp_score ?? dossier?.icp_score, 90)}/100
                    </div>
                  </div>
                </div>

                {/* Confirmed Plants & Product Line */}
                <div className="mt-2.5 p-3 rounded-xl bg-[var(--glass)] border border-[var(--line)] space-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-[var(--ink3)] uppercase font-semibold">
                      {techObj.seller_company || (techObj.dataset?.includes("EXTRIEVE") ? "Extrieve" : "HTL")} Product Match:{" "}
                    </span>
                    <span className="font-semibold text-brand">
                      {safeString(techObj.recommended_extrieve_product || techObj.product_line || techObj.hdl_product_line, "Enterprise Solutions")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[var(--ink3)] uppercase font-semibold">
                      {techObj.dataset?.includes("EXTRIEVE") ? "Relevant Workflow: " : "Plants Confirmed: "}
                    </span>
                    <span className="text-[var(--ink)]">
                      {safeString(techObj.relevant_document_workflow || techObj.plants_confirmed, "Operational workflows verified")}
                    </span>
                  </div>
                </div>
              </SafeSection>

              {/* Intent Basis Card */}
              {techObj.intent_basis && (
                <SafeSection title="Intent Basis">
                  <div className="p-3.5 rounded-xl bg-[var(--glass)] border border-[var(--line)] space-y-1">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink3)] flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-brand" /> Intent Basis
                    </div>
                    <p className="text-xs text-[var(--ink)] leading-relaxed font-mono">
                      {techObj.intent_basis}
                    </p>
                  </div>
                </SafeSection>
              )}

              {/* Pain / Angle: From analyst research */}
              <SafeSection title="Pain & Outreach Angle">
                <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> From Analyst Research
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                      Calibrated Positioning
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase text-[var(--ink3)] font-semibold">Outreach Angle:</div>
                    <p className="text-xs text-[var(--ink)] leading-relaxed italic bg-[var(--glass)] p-2.5 rounded-lg border border-[var(--line)]">
                      "{safeString(techObj.outreach_angle || dossier?.recommended_opener, "Direct strategic supplier engagement")}"
                    </p>
                  </div>

                  {techObj.risks_caveats && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase text-amber-400 font-semibold">Risks / Caveats:</div>
                      <p className="text-xs text-amber-300/90 leading-relaxed bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 font-mono text-[11px]">
                        {techObj.risks_caveats}
                      </p>
                    </div>
                  )}
                </div>
              </SafeSection>

              {/* Why Now: Signals with Clickable URLs & Primary/Secondary Badges */}
              <SafeSection title="Buying Signals">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)]">
                      Why Now — Verified Buying Signals
                    </div>
                    <span className="text-[10px] font-mono text-[var(--ink3)]">
                      {allSignals.length} recorded
                    </span>
                  </div>

                  {allSignals.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--line)] text-center text-xs text-[var(--ink3)] italic">
                      No signal in window
                    </div>
                  ) : (
                    allSignals.map((sig, idx) => {
                      const dateStr = sig.publication_date || sig.event_date || "Recent";
                      const strength =
                        (sig as any).strength ||
                        String(sig.explanation || "").match(/Strength:\s*([A-Za-z]+)/i)?.[1] ||
                        (sig.confidence >= 0.85 ? "Strong" : sig.confidence >= 0.65 ? "Medium" : "Weak");

                      const sourceName =
                        String(sig.explanation || "").match(/Source:\s*([^|]+)/i)?.[1]?.trim() ||
                        (sig.evidence_url ? (() => { try { return new URL(sig.evidence_url).hostname.replace(/^www\./, ""); } catch { return "Source"; } })() : "Analyst Research");

                      const isPrimary = isPrimarySource(sig.evidence_url || "", sourceName);

                      return (
                        <div
                          key={sig.id || `sig-${idx}`}
                          className="p-3 rounded-xl bg-[var(--glass)] border border-[var(--line)] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                            <div className="flex items-center gap-1.5">
                              {isPrimary ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                  Primary
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 font-semibold">
                                  Secondary
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-brand/10 text-brand border border-brand/20">
                                {strength}
                              </span>
                              <span className="font-semibold text-[var(--ink)] truncate max-w-xs">{sourceName}</span>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--ink3)]">
                              Published {dateStr}
                            </span>
                          </div>

                          <p className="text-xs text-[var(--ink2)] italic leading-relaxed">
                            "{safeString(sig.supporting_excerpt || sig.title)}"
                          </p>

                          {sig.evidence_url && (
                            <div className="pt-1">
                              <a
                                href={sig.evidence_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-brand hover:underline inline-flex items-center gap-1 font-mono"
                              >
                                View Source Evidence <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </SafeSection>

              {/* Buying Group: Contacts */}
              <SafeSection title="Buying Group & Contacts">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> Buying Group ({sortedContacts.length})
                    </div>
                    {bestEntryRaw && (
                      <span className="text-[10px] font-mono text-amber-400 truncate max-w-xs">
                        Target Entry: {bestEntryRaw.split("-")[0].trim()}
                      </span>
                    )}
                  </div>

                  {sortedContacts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--line)] text-center text-xs text-[var(--ink3)] italic">
                      No contact in source file
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {sortedContacts.map((c) => {
                        const tierMatch = String(c.icp_reason || "").match(/\[Tier:\s*([^\]]+)\]/i);
                        const tierName = tierMatch ? tierMatch[1] : (String(c.icp_reason || "").match(/Tier:\s*([^|]+)/i)?.[1]?.trim() || "Category");
                        const isBestEntry =
                          bestEntryRaw &&
                          (bestEntryRaw.toLowerCase().includes((c.first_name || "").toLowerCase()) ||
                            bestEntryRaw.toLowerCase().includes((c.last_name || "").toLowerCase()));

                        return (
                          <div
                            key={c.id}
                            className={`p-3 rounded-xl border space-y-1.5 ${
                              isBestEntry
                                ? "bg-amber-500/5 border-amber-500/30"
                                : "bg-[var(--glass)] border-[var(--line)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                                  <span>{c.first_name} {c.last_name}</span>
                                  {isBestEntry && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
                                      ⭐ Best Entry Contact
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--ink2)]">{c.title}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 pt-1 text-xs flex-wrap">
                              <span className="text-[11px] text-[var(--ink3)] flex items-center gap-1 font-mono">
                                <MapPin className="w-3 h-3" /> {safeString(c.contact_city, "India")}
                              </span>

                              {c.personal_linkedin && (
                                <a
                                  href={c.personal_linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand hover:underline inline-flex items-center gap-0.5 text-[11px]"
                                >
                                  LinkedIn Profile <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}

                              {c.work_email ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-brand text-xs">{c.work_email}</span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 font-semibold">
                                    Unverified (not bounce-verified)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[var(--ink3)] italic">
                                  Email not found in source file
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SafeSection>

              {/* Outreach Draft Generator (Step 3: No Sending, Copy Only) */}
              <SafeSection title="Outreach Draft">
                <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Calibrated Outreach Draft
                    </span>
                    {!generatedDraft ? (
                      <button
                        type="button"
                        onClick={handleGenerateDraft}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> Generate Draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCopyDraft}
                        className="text-xs text-brand hover:underline flex items-center gap-1 font-semibold"
                      >
                        {copiedDraft ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDraft ? "Copied!" : "Copy Draft"}</span>
                      </button>
                    )}
                  </div>

                  {generatedDraft ? (
                    <div className="space-y-2">
                      <pre className="p-3 rounded-lg bg-[var(--glass)] border border-[var(--line2)] text-xs text-[var(--ink)] font-mono whitespace-pre-wrap leading-relaxed">
                        {generatedDraft}
                      </pre>
                      {draftSourceUrl && (
                        <div className="text-[10px] font-mono text-[var(--ink3)] flex items-center gap-1 truncate">
                          <span>Evidence Source:</span>
                          <a
                            href={draftSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline truncate"
                          >
                            {draftSourceUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink3)] italic">
                      Generate a deterministic outreach email using only stored fields (top signal, outreach angle, product line, best entry contact). No LLM call or email sending.
                    </p>
                  )}
                </div>
              </SafeSection>
            </>
          ) : (
            /* ========================================================================= */
            /* LIVE RUN CARD VIEW (SAFE RENDERING)                                       */
            /* ========================================================================= */
            <>
              {/* Firmographic Snapshot */}
              <SafeSection title="Firmographic Snapshot">
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[var(--glass)] border border-[var(--line)]">
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Industry</span>
                    <div className="text-xs font-semibold text-[var(--ink)] mt-0.5">
                      {safeString(company?.industry, "B2B Enterprise")}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Scale</span>
                    <div className="text-xs font-semibold text-[var(--ink)] mt-0.5">
                      {company?.employee_count ? `${Number(company.employee_count).toLocaleString()} employees` : "Not available"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink3)] font-mono uppercase">Match Score</span>
                    <div className="text-xs font-mono font-bold text-brand mt-0.5">
                      {safeNumber(company?.icp_score || dossier?.icp_score, 80)}/100
                    </div>
                  </div>
                </div>
              </SafeSection>

              {/* Why This Account Matches ICP */}
              <SafeSection title="Why It Matches">
                {(() => {
                  const why =
                    (dossier?.icp_score_breakdown as any)?.why_it_matches ||
                    (company?.company_technologies as any)?.why_it_matches ||
                    company?.overview ||
                    company?.icp_fit_reason;

                  if (!why) return null;
                  const cleanWhy = safeString(why).replace(/^\[Origin:[^\]]+\]\s*/i, "");

                  return (
                    <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/20 space-y-1">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Why This Account Matches ICP
                      </div>
                      <p className="text-xs text-[var(--ink)] leading-relaxed">{cleanWhy}</p>
                    </div>
                  );
                })()}
              </SafeSection>

              {/* Match Score Breakdown & Formula (Safe Numbers Only) */}
              <SafeSection title="Score Breakdown">
                {(() => {
                  const breakdown =
                    (dossier?.icp_score_breakdown as any)?.breakdown ||
                    (company?.company_technologies as any)?.score_breakdown;
                  if (!breakdown || typeof breakdown !== "object") return null;

                  const icpVal = safeNumber(breakdown.icp_relevance ?? breakdown.icpRelevance, 35);
                  const sigVal = safeNumber(breakdown.signal_strength ?? breakdown.signalStrength, 25);
                  const srcVal = safeNumber(breakdown.source_quality ?? breakdown.sourceQuality, 18);
                  const recVal = safeNumber(breakdown.recency, 8);

                  return (
                    <div className="p-3.5 rounded-xl bg-[var(--glass)] border border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink)]">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-brand" /> Match Score Breakdown
                        </span>
                        <span className="font-mono text-brand font-bold">
                          {safeNumber(company?.icp_score || dossier?.icp_score, 80)}/100
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                        <div className="p-2 rounded-lg bg-black/20 border border-[var(--line2)]">
                          <div className="text-[10px] text-[var(--ink3)]">ICP Relevance (40%)</div>
                          <div className="font-bold text-emerald-400 mt-0.5">{icpVal}/40</div>
                        </div>
                        <div className="p-2 rounded-lg bg-black/20 border border-[var(--line2)]">
                          <div className="text-[10px] text-[var(--ink3)]">Signal Strength (30%)</div>
                          <div className="font-bold text-sky-400 mt-0.5">{sigVal}/30</div>
                        </div>
                        <div className="p-2 rounded-lg bg-black/20 border border-[var(--line2)]">
                          <div className="text-[10px] text-[var(--ink3)]">Source Quality (20%)</div>
                          <div className="font-bold text-amber-400 mt-0.5">{srcVal}/20</div>
                        </div>
                        <div className="p-2 rounded-lg bg-black/20 border border-[var(--line2)]">
                          <div className="text-[10px] text-[var(--ink3)]">Recency (10%)</div>
                          <div className="font-bold text-purple-400 mt-0.5">{recVal}/10</div>
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--ink3)]">
                        Formula: 0.40 × ICP Relevance + 0.30 × Signal Strength + 0.20 × Source Authority + 0.10 × Recency.
                      </p>
                    </div>
                  );
                })()}
              </SafeSection>

              {/* Verified Decision Maker Card */}
              <SafeSection title="Decision Maker">
                <div className="p-4 rounded-xl bg-[var(--glass)] border border-[var(--line)] space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> Key Decision Maker &amp; Persona
                    </div>
                    {targetContact?.verification_status === "verified_current" ? (
                      <span className="chip-badge bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> Active Role Confirmed
                      </span>
                    ) : (
                      <span className="chip-badge bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                        Pending Verification
                      </span>
                    )}
                  </div>

                  {targetContact ? (
                    <div className="pt-2 border-t border-[var(--line)] space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="text-sm font-bold text-[var(--ink)]">
                            {targetContact.first_name} {targetContact.last_name}
                          </div>
                          <div className="text-xs text-[var(--ink2)]">{targetContact.title}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-1 text-xs flex-wrap">
                        <span className="font-mono text-brand">
                          {targetContact.work_email || (targetContact.first_name === "Not available" ? "Not available" : "Email not found in source file")}
                        </span>
                        {targetContact.personal_linkedin && (
                          <a
                            href={targetContact.personal_linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline inline-flex items-center gap-0.5 text-[11px]"
                          >
                            LinkedIn Profile <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[var(--line)] space-y-1">
                      <div className="text-xs font-semibold text-[var(--ink)]">
                        {techObj.best_entry_contact || "None in source files — enrich (procurement head)"}
                      </div>
                      <div className="text-[11px] text-[var(--ink2)] leading-relaxed">
                        Target personas: {techObj.target_personas || "Head Supply Chain; Commodity/Procurement Manager"}
                      </div>
                    </div>
                  )}
                </div>
              </SafeSection>

              {/* Buying Signals Evidence */}
              <SafeSection title="Signals Evidence">
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)]">
                    Captured Buying Signals &amp; Evidence
                  </div>
                  {signals.length === 0 ? (
                    <p className="text-xs text-[var(--ink3)] italic">
                      No signals logged yet.
                    </p>
                  ) : (
                    signals.map((sig) => (
                      <div
                        key={sig.id}
                        className="p-3 rounded-xl bg-[var(--glass)] border border-[var(--line)] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <span className="font-semibold text-[var(--ink)]">{sig.title}</span>
                          <span className="font-mono text-[10px] text-brand">
                            Confidence {safeNumber(sig.confidence * 100, 85).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-[var(--ink2)] italic">"{safeString(sig.supporting_excerpt)}"</p>
                        {sig.evidence_url && (
                          <div className="pt-1">
                            <a
                              href={sig.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-brand hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              View Source Evidence <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </SafeSection>

              {/* Recommended Outreach Opener */}
              {dossier?.recommended_opener && (
                <SafeSection title="Outreach Opener">
                  <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Calibrated Outreach Opener
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(dossier.recommended_opener || "");
                        }}
                        className="text-[10px] text-brand hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy Opener
                      </button>
                    </div>
                    <p className="text-xs text-[var(--ink)] leading-relaxed italic bg-[var(--glass)] p-3 rounded-lg border border-brand/10">
                      "{dossier.recommended_opener}"
                    </p>
                  </div>
                </SafeSection>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAccepted(true);
                setChallengeSuccess(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Accept Account
            </button>
            <button
              type="button"
              onClick={() => setShowChallengeModal(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Challenge (SLA Refund)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCopyLab();
              }}
              className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              Open in Copy Lab <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Challenge Modal */}
        {showChallengeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--line)] rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-[var(--ink)]">Challenge Account Quality (RAD-08)</h3>
                </div>
                <button type="button" onClick={() => setShowChallengeModal(false)} className="text-[var(--ink3)] hover:text-white cursor-pointer">✕</button>
              </div>

              <p className="text-xs text-[var(--ink3)]">
                Upheld quality disputes automatically refund $10 credits to your workspace ledger and inject disqualifiers back into the AI targeting spec.
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[var(--ink2)] block">Select Challenge Reason:</label>
                <select
                  value={challengeReason}
                  onChange={(e) => setChallengeReason(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[var(--glass)] border border-[var(--line2)] text-xs text-[var(--ink)] outline-none"
                >
                  <option value="Wrong-fit buyer persona">Wrong-fit buyer persona (e.g. not decision maker)</option>
                  <option value="Dead company or ceased operations">Dead company / out of business</option>
                  <option value="Headcount or scale out of bounds">Headcount out of bounds (&lt;50 or &gt;1,000)</option>
                  <option value="No active commercial trigger">No active commercial buying trigger in 90 days</option>
                  <option value="Existing client or active pipeline">Existing customer or active pipeline</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChallengeModal(false)}
                  className="btn-secondary text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingChallenge}
                  onClick={async () => {
                    setIsSubmittingChallenge(true);
                    try {
                      const res = await fetch("/api/companies/challenge", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          companyId: company?.id,
                          companyName: company?.company_name || companyName,
                          workspaceId,
                          reason: challengeReason,
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setChallengeSuccess(data.message || "Challenge upheld. $10 credit auto-issued.");
                        setShowChallengeModal(false);
                      }
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsSubmittingChallenge(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingChallenge ? "Processing..." : "Submit Challenge & Issue Credit"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
