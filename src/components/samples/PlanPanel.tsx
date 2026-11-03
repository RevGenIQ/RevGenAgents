"use client";

import React, { useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { sendWorkspaceChatMessage } from "@/lib/store/osWorkflowStore";

const INCLUDED = [
  "35 accounts a month matched to your ICP",
  "Every account researched by the agent, then enriched and checked by your dedicated Humagent",
  "Up to 3 decision-maker contacts per account with verified emails",
  "Dated buying signals with sources, why-fit and what-to-pitch on every account",
  "CSV and PDF delivery, plus a shared channel with your team",
];

interface PlanPanelProps {
  workspaceId: string;
  tier: string;
  onOpenChannel: () => void;
}

/** What the paid plan includes, with a one-click way to start the conversation. */
export function PlanPanel({ workspaceId, tier, onOpenChannel }: PlanPanelProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const premium = tier === "premium";

  const requestCall = async () => {
    setSending(true);
    const res = await sendWorkspaceChatMessage({
      workspaceId,
      messageType: premium ? "lead_request" : "text",
      content: premium
        ? "I'd like more leads for this month on the same ICP."
        : "I've reviewed my free samples and would like to talk about the 35-accounts-a-month plan.",
      metadata: premium ? { requestedLeads: "35", requestNote: "Same ICP as the sample" } : {},
    });
    setSending(false);
    if (res.ok) setSent(true);
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{premium ? "Your plan" : "What you get on the plan"}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            {premium ? "Premium: request your next batch any time" : "35 researched and enriched accounts, every month"}
          </h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> {i}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 lg:min-w-[220px]">
          {sent ? (
            <button type="button" onClick={onOpenChannel} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Check className="w-4 h-4" /> Sent. Open the channel
            </button>
          ) : (
            <button type="button" onClick={requestCall} disabled={sending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white">
              {sending ? "Sending..." : premium ? "Request more leads" : "Talk to us about the plan"}
            </button>
          )}
          <button type="button" onClick={onOpenChannel}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            <MessageSquare className="w-4 h-4" /> Message the team
          </button>
        </div>
      </div>
    </section>
  );
}
