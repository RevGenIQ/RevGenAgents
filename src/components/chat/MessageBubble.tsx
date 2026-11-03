"use client";

import React from "react";
import { Calendar, ExternalLink, FileText, Receipt, Sliders, Target, Video } from "lucide-react";
import type { WorkspaceChatMessage } from "@/lib/store/osWorkflowStore";
import { ROLE_LABEL, initials, timeLabel } from "./chatFormat";

const ROLE_NAME_COLOR: Record<WorkspaceChatMessage["senderRole"], string> = {
  admin: "text-indigo-600 dark:text-indigo-400",
  humagent: "text-emerald-700 dark:text-emerald-400",
  client: "text-sky-700 dark:text-sky-400",
  system: "text-slate-500",
};

const ROLE_AVATAR: Record<WorkspaceChatMessage["senderRole"], string> = {
  admin: "bg-indigo-600 text-white",
  humagent: "bg-emerald-600 text-white",
  client: "bg-sky-600 text-white",
  system: "bg-slate-400 text-white",
};

function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function Attachment({ icon, title, detail, href, action }: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2">
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold truncate">{title}</span>
        {detail && <span className="block text-[11px] opacity-75 truncate">{detail}</span>}
      </span>
      {href && (
        <a href={safeHref(href)} target="_blank" rel="noreferrer noopener"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2">
          {action || "Open"} <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function Attachments({ msg }: { msg: WorkspaceChatMessage }) {
  const m = msg.metadata || {};
  switch (msg.messageType) {
    case "google_meet":
      return m.meetUrl ? <Attachment icon={<Video className="w-4 h-4" />} title="Google Meet" detail={m.meetUrl} href={m.meetUrl} action="Join" /> : null;
    case "appointment":
      return <Attachment icon={<Calendar className="w-4 h-4" />} title="Meeting scheduled" detail={[m.appointmentDate, m.appointmentTime].filter(Boolean).join(" · ") || "Time to be confirmed"} />;
    case "document":
      return m.docUrl ? <Attachment icon={<FileText className="w-4 h-4" />} title={m.docTitle || "Shared document"} detail={m.docUrl} href={m.docUrl} /> : null;
    case "payment":
      return <Attachment icon={<Receipt className="w-4 h-4" />} title={m.paymentStatus || "Payment update"} detail={m.paymentAmount} />;
    case "icp_upgrade":
    case "icp_change_request":
      return <Attachment icon={<Sliders className="w-4 h-4" />} title={msg.messageType === "icp_upgrade" ? "ICP updated" : "ICP change requested"} detail={m.icpSummary || m.requestNote} />;
    case "lead_request":
      return <Attachment icon={<Target className="w-4 h-4" />} title={`More leads requested${m.requestedLeads ? `: ${m.requestedLeads}` : ""}`} detail={m.requestNote} />;
    default:
      return null;
  }
}

interface MessageBubbleProps {
  msg: WorkspaceChatMessage;
  own: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
}

/** One chat message: centred notice for system events, otherwise a left/right bubble. */
export function MessageBubble({ msg, own, startsGroup, endsGroup }: MessageBubbleProps) {
  if (msg.senderRole === "system") {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 px-3 py-1.5 text-center text-xs text-slate-700 dark:text-slate-300">
          {msg.content}
          <span className="ml-2 text-[10px] text-slate-500">{timeLabel(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  const tail = endsGroup ? (own ? "rounded-br-sm" : "rounded-bl-sm") : "";
  return (
    <div className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"} ${startsGroup ? "mt-3" : "mt-0.5"}`}>
      {!own && (
        <span aria-hidden="true"
          className={`w-8 h-8 shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center ${endsGroup ? ROLE_AVATAR[msg.senderRole] : "invisible"}`}>
          {initials(msg.senderName)}
        </span>
      )}
      <div
        className={`max-w-[78%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.08)] ${tail} ${
          own
            ? "bg-indigo-600 text-white"
            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700"
        }`}
      >
        {!own && startsGroup && (
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className={`text-xs font-semibold ${ROLE_NAME_COLOR[msg.senderRole]}`}>{msg.senderName}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{ROLE_LABEL[msg.senderRole]}</span>
          </div>
        )}
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
        <Attachments msg={msg} />
        <div className={`mt-0.5 text-right text-[10px] ${own ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
          {timeLabel(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}
