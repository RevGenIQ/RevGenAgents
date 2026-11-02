"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

interface PendingRun {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string | null;
  currentStep: string | null;
  leadsFound: number;
  leadsVerified: number;
  updatedAt: string;
}

interface ReviewCard {
  companyId: string;
  name: string;
  domain: string;
  score: number | null;
  signals: number;
  verifiedContacts: number;
  headline: string;
  contactSummary: string;
}

type Decision = "approve" | "reject";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorText(body: Record<string, unknown>, fallback: string): string {
  const message = body.error ?? body.message;
  return typeof message === "string" && message ? message : fallback;
}

/**
 * Humagent/Admin review step for LangGraph runs: lists runs paused at
 * humagentReview, shows their candidate cards, and submits approve/reject
 * decisions, which resumes the run (approved cards are published to the client).
 */
export function RunReviewQueue() {
  const [runs, setRuns] = useState<PendingRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setIsLoadingRuns(true);
    setListError(null);
    try {
      const res = await fetch("/api/runs/pending-review", { credentials: "include" });
      const body = await readJson(res);
      if (!res.ok) {
        setListError(errorText(body, "Could not load runs awaiting review."));
        return;
      }
      setRuns(Array.isArray(body.runs) ? (body.runs as PendingRun[]) : []);
    } catch {
      setListError("Network error while loading runs awaiting review.");
    } finally {
      setIsLoadingRuns(false);
    }
  }, []);

  const loadCards = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    setCards([]);
    setDecisions({});
    setCardsError(null);
    setIsLoadingCards(true);
    try {
      const res = await fetch(`/api/runs/${runId}/review`, { credentials: "include" });
      const body = await readJson(res);
      if (!res.ok) {
        setCardsError(errorText(body, "Could not load this run's cards."));
        return;
      }
      const review = body.review as { cards?: ReviewCard[] } | null;
      if (!review) {
        setCardsError("This run is no longer waiting for review.");
        return;
      }
      setCards(Array.isArray(review.cards) ? review.cards : []);
    } catch {
      setCardsError("Network error while loading this run's cards.");
    } finally {
      setIsLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    // Fetching on mount is the external sync this effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRuns();
  }, [loadRuns]);

  const decidedCount = useMemo(
    () => cards.filter((c) => decisions[c.companyId]).length,
    [cards, decisions]
  );
  const approvedCount = useMemo(
    () => cards.filter((c) => decisions[c.companyId] === "approve").length,
    [cards, decisions]
  );
  const allDecided = cards.length > 0 && decidedCount === cards.length;

  const decide = (companyId: string, decision: Decision) =>
    setDecisions((prev) => ({ ...prev, [companyId]: decision }));

  const decideAll = (decision: Decision) =>
    setDecisions(Object.fromEntries(cards.map((c) => [c.companyId, decision])));

  const submit = async () => {
    if (!allDecided || isSubmitting) return;
    setIsSubmitting(true);
    setCardsError(null);
    try {
      const res = await fetch(`/api/runs/${selectedRunId}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: cards.map((c) => ({ companyId: c.companyId, action: decisions[c.companyId] })),
        }),
      });
      const body = await readJson(res);
      if (!res.ok) {
        setCardsError(errorText(body, "Could not submit the review."));
        return;
      }
      setNotice(
        `Review submitted: ${approvedCount} card${approvedCount === 1 ? "" : "s"} will be published to the client, ${
          cards.length - approvedCount
        } rejected.`
      );
      setSelectedRunId("");
      setCards([]);
      setDecisions({});
      await loadRuns();
    } catch {
      setCardsError("Network error while submitting the review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section aria-labelledby="review-runs-heading" className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="review-runs-heading" className="text-xs font-mono uppercase text-indigo-800 font-extrabold">
            Runs awaiting review ({runs.length})
          </h2>
          <button
            type="button"
            onClick={loadRuns}
            disabled={isLoadingRuns}
            aria-label="Refresh runs awaiting review"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingRuns ? "animate-spin" : ""}`} />
          </button>
        </div>

        {notice && (
          <p role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            {notice}
          </p>
        )}

        {listError ? (
          <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{listError}</p>
        ) : isLoadingRuns ? (
          <p className="p-6 text-xs text-slate-500 text-center">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center space-y-2">
            <ClipboardCheck className="w-5 h-5 text-slate-400 mx-auto" />
            <p>No research runs are waiting for your review.</p>
            <p className="text-[11px]">A run pauses here once its agents have prepared account cards.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => loadCards(run.id)}
                  aria-pressed={selectedRunId === run.id}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    selectedRunId === run.id
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-900">{run.workspaceName}</span>
                  <span className="block text-[11px] text-slate-600 mt-0.5 truncate">{run.name || "Research run"}</span>
                  <span className="block text-[11px] text-slate-500 mt-1">{run.currentStep}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="review-cards-heading" className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-4">
        {!selectedRunId ? (
          <div className="py-16 text-center text-xs text-slate-500 space-y-2">
            <ShieldCheck className="w-6 h-6 text-slate-400 mx-auto" />
            <p id="review-cards-heading">Select a run to review its account cards.</p>
            <p className="text-[11px]">Approved cards are published to the client. Rejected cards are not delivered.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="review-cards-heading" className="text-sm font-extrabold text-slate-900">
                  Review account cards
                </h2>
                <p className="text-[11px] text-slate-500">
                  {decidedCount} of {cards.length} decided · a review can only be submitted once
                </p>
              </div>
              {cards.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => decideAll("approve")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Approve all
                  </button>
                  <button
                    type="button"
                    onClick={() => decideAll("reject")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Reject all
                  </button>
                </div>
              )}
            </div>

            {cardsError && (
              <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{cardsError}</p>
            )}

            {isLoadingCards ? (
              <p className="py-10 text-center text-xs text-slate-500">Loading cards…</p>
            ) : (
              <ul className="space-y-3">
                {cards.map((card) => {
                  const decision = decisions[card.companyId];
                  return (
                    <li
                      key={card.companyId}
                      className={`p-4 rounded-xl border ${
                        decision === "approve"
                          ? "border-emerald-300 bg-emerald-50/40"
                          : decision === "reject"
                          ? "border-rose-200 bg-rose-50/40"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">{card.name}</p>
                          <p className="text-[11px] text-slate-500">{card.domain}</p>
                        </div>
                        <div className="flex gap-2" role="group" aria-label={`Decision for ${card.name}`}>
                          <button
                            type="button"
                            onClick={() => decide(card.companyId, "approve")}
                            aria-pressed={decision === "approve"}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border ${
                              decision === "approve"
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-emerald-50"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(card.companyId, "reject")}
                            aria-pressed={decision === "reject"}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border ${
                              decision === "reject"
                                ? "bg-rose-600 border-rose-600 text-white"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-rose-50"
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </div>

                      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <dt className="text-slate-500">Fit score</dt>
                          <dd className="font-bold text-slate-900">{card.score ?? "Unscored"}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Evidenced signals</dt>
                          <dd className="font-bold text-slate-900">{card.signals}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Verified contacts</dt>
                          <dd className={`font-bold ${card.verifiedContacts > 0 ? "text-slate-900" : "text-amber-700"}`}>
                            {card.verifiedContacts}
                          </dd>
                        </div>
                      </dl>
                      {card.headline && <p className="mt-2 text-xs text-slate-700">{card.headline}</p>}
                      {card.contactSummary && <p className="mt-1 text-[11px] text-slate-500">{card.contactSummary}</p>}
                    </li>
                  );
                })}
              </ul>
            )}

            {cards.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
                {!allDecided && (
                  <p className="text-[11px] text-slate-500">Decide every card before submitting.</p>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!allDecided || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit review ({approvedCount} to publish)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
