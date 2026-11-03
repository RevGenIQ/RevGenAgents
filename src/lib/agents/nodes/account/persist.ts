/**
 * persistAccount: idempotent writes (P0-6).
 * companies upsert on (workspace_id, canonical_domain); contacts on
 * (workspace_id, work_email); signals deduplicated on (company_id, evidence_url);
 * dossiers on (workspace_id, company_id). Running it twice changes nothing new.
 */

import type { AgentDeps, CompanyUpsert } from "../../deps";
import type { AccountStateType, AccountUpdate } from "../../state";
import type { Dossier, FitScore, VerifiedContact } from "../../types";
import { reportProgress } from "../guards";

function buyingRole(title: string, seniority: string): "Economic Buyer" | "Champion" | "Influencer" {
  const t = `${title} ${seniority}`.toLowerCase();
  if (/\b(chief|c-suite|ceo|cfo|coo|cro|cto|president|founder|vp|vice president|managing director)\b/.test(t)) {
    return "Economic Buyer";
  }
  if (/\b(head|director|lead)\b/.test(t)) return "Champion";
  return "Influencer";
}

function contactCard(c: VerifiedContact, country: string): Record<string, unknown> {
  return {
    id: `contact-${c.workEmail}`,
    role: buyingRole(c.title, c.seniority),
    name: `${c.firstName} ${c.lastName}`.trim(),
    title: c.title,
    location: country,
    email: c.workEmail,
    phone: c.phone || "",
    linkedinUrl: c.linkedinUrl,
    verificationStatus: c.verified ? "✓ Direct verified" : "⚠ Re-verify",
    tenureNote: c.evidenceNote,
    whyThisContact: c.verificationReason,
  };
}

function priorityBand(tier: Dossier["tier"]): CompanyUpsert["priorityBand"] {
  return tier === "P1" ? "High Priority" : tier === "P2" ? "Medium Priority" : "Watchlist";
}

function scoringJson(score: FitScore, verified: VerifiedContact[], dossier: Dossier): Record<string, unknown> {
  const verifiedPct = verified.length > 0 ? Math.round((verified.filter((c) => c.verified).length / verified.length) * 100) : 0;
  return {
    icpFitScore: score.fitScore,
    intentScore: score.intentScore,
    verifyScore: verifiedPct,
    verificationPct: verifiedPct,
    intentBasis: score.rationale,
    windowLabel: `${dossier.windowDays}-day window`,
  };
}

export function createPersistAccount(deps: AgentDeps) {
  return async function persistAccount(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context, signals, verified, score, dossier, profile } = state;
    if (!score || !dossier) {
      return { outcome: "failed", reason: "persistAccount reached without a score or dossier." };
    }
    const primary = signals[0];

    const companyId = await deps.repo.upsertCompany({
      workspaceId: context.workspaceId,
      domain: candidate.domain,
      name: candidate.name,
      industry: profile.industry?.value || candidate.industry,
      country: profile.country?.value || candidate.country,
      overview: dossier.summary,
      icpScore: score.combined,
      fitReason: `[Origin: LangGraph run] ${score.rationale}`,
      scoring: scoringJson(score, verified, dossier),
      priorityBand: priorityBand(dossier.tier),
      signalHeadline: primary ? primary.title : "",
      signalBody: primary ? `"${primary.quote}" (${primary.sourceDate})` : "",
      painPoint: dossier.painPoint,
      opener: dossier.opener,
      contactsJson: verified.map((c) => contactCard(c, candidate.country)),
      evidenceJson: signals.map((s, i) => ({
        ref: `[${i + 1}]`,
        title: `${s.title} (${s.sourceDate})`,
        whatItEvidences: s.quote,
        url: s.sourceUrl,
        sourceEngine: "Crawler",
      })),
      runId: context.runId,
      profile,
      signals,
      whyIcpFit: score.whyIcpFit || "",
      whatToPitch: score.whatToPitch || "",
    });

    await deps.repo.insertSignals(
      context.workspaceId,
      companyId,
      signals.map((s) => ({
        signalType: s.signalType,
        title: s.title,
        quote: s.quote,
        sourceUrl: s.sourceUrl,
        sourceDate: s.sourceDate,
        confidence: Number((score.intentScore / 100).toFixed(2)),
        explanation: score.rationale,
      }))
    );

    const contactIds: Array<{ id: string; verified: boolean }> = [];
    for (const c of verified.filter((v) => v.workEmail)) {
      const id = await deps.repo.upsertContact({
        workspaceId: context.workspaceId,
        companyId,
        companyName: candidate.name,
        companyDomain: candidate.domain,
        firstName: c.firstName,
        lastName: c.lastName || "-",
        title: c.title,
        seniority: c.seniority,
        department: c.department,
        workEmail: c.workEmail,
        linkedinUrl: c.linkedinUrl,
        phone: c.phone,
        country: candidate.country,
        roleStartDate: c.roleStartDate,
        verificationStatus: c.verified ? "verified_current" : "unverified",
        emailStatus: c.emailStatus,
        icpScore: score.combined,
        icpReason: `[Origin: LangGraph run] ${c.verificationReason} Email source: ${c.emailSource}.`,
      });
      contactIds.push({ id, verified: c.verified });
    }

    const target = contactIds.find((c) => c.verified) || contactIds[0];
    await deps.repo.upsertDossier({
      workspaceId: context.workspaceId,
      companyId,
      targetContactId: target ? target.id : null,
      summary: dossier.summary,
      icpScore: score.combined,
      breakdown: { fit_score: score.fitScore, intent_score: score.intentScore, rationale: score.rationale },
      windowDays: dossier.windowDays,
      tier: dossier.tier,
      triggers: signals.map((s) => ({ trigger: s.title, date: s.sourceDate, evidence_url: s.sourceUrl, quote: s.quote })),
      opener: dossier.opener,
      talkingPoints: dossier.talkingPoints,
    });

    await reportProgress(deps, context.runId, `Persisted ${candidate.name} for Humagent review.`, 70);
    return { companyId, outcome: "persisted", reason: "Ready for Humagent review." };
  };
}
