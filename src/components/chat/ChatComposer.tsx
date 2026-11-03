"use client";

import React, { useEffect, useRef, useState } from "react";
import { Calendar, FileText, Paperclip, Receipt, Send, Target, Video, X } from "lucide-react";
import type { WorkspaceChatMessage } from "@/lib/store/osWorkflowStore";
import type { ChatRole } from "./chatFormat";

type ComposerMode = "text" | "google_meet" | "appointment" | "document" | "payment" | "lead_request";

export interface OutgoingMessage {
  messageType: WorkspaceChatMessage["messageType"];
  content: string;
  metadata: NonNullable<WorkspaceChatMessage["metadata"]>;
}

interface ChatComposerProps {
  role: ChatRole;
  channelName: string;
  disabled?: boolean;
  onSend: (msg: OutgoingMessage) => Promise<boolean>;
}

const MAX_LENGTH = 5000;

const ATTACH_OPTIONS: Array<{ mode: ComposerMode; label: string; icon: React.ReactNode; roles: ChatRole[] }> = [
  { mode: "google_meet", label: "Google Meet link", icon: <Video className="w-4 h-4" />, roles: ["admin", "humagent", "client"] },
  { mode: "appointment", label: "Schedule a call", icon: <Calendar className="w-4 h-4" />, roles: ["admin", "humagent", "client"] },
  { mode: "document", label: "Share a document", icon: <FileText className="w-4 h-4" />, roles: ["admin", "humagent", "client"] },
  { mode: "lead_request", label: "Request more leads", icon: <Target className="w-4 h-4" />, roles: ["client"] },
  { mode: "payment", label: "Payment update", icon: <Receipt className="w-4 h-4" />, roles: ["admin"] },
];

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500";

/** WhatsApp-style composer: auto-growing text box, Enter to send, attachments behind a paperclip. */
export function ChatComposer({ role, channelName, disabled, onSend }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ComposerMode>("text");
  const [menuOpen, setMenuOpen] = useState(false);
  const [fieldA, setFieldA] = useState("");
  const [fieldB, setFieldB] = useState("");
  const [sending, setSending] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const reset = () => {
    setText("");
    setFieldA("");
    setFieldB("");
    setMode("text");
  };

  const build = (): OutgoingMessage | null => {
    const body = text.trim();
    const a = fieldA.trim();
    const b = fieldB.trim();
    switch (mode) {
      case "google_meet":
        return a ? { messageType: "google_meet", content: body || "Join me on Google Meet", metadata: { meetUrl: a } } : null;
      case "appointment":
        return a ? { messageType: "appointment", content: body || "Proposed a call", metadata: { appointmentDate: a, appointmentTime: b, agenda: body } } : null;
      case "document":
        return b ? { messageType: "document", content: body || `Shared ${a || "a document"}`, metadata: { docTitle: a || "Document", docUrl: b } } : null;
      case "payment":
        return a ? { messageType: "payment", content: body || `Payment update: ${a}`, metadata: { paymentAmount: a, paymentStatus: b || "Invoice shared" } } : null;
      case "lead_request":
        return a || body ? { messageType: "lead_request", content: body || `Requesting ${a} more leads`, metadata: { requestedLeads: a, requestNote: body } } : null;
      default:
        return body ? { messageType: "text", content: body, metadata: {} } : null;
    }
  };

  const submit = async () => {
    const outgoing = build();
    if (!outgoing || sending || disabled) return;
    setSending(true);
    try {
      if (await onSend(outgoing)) reset();
    } finally {
      setSending(false);
    }
  };

  const fields: Record<Exclude<ComposerMode, "text">, { title: string; a: React.ReactNode; b?: React.ReactNode }> = {
    google_meet: { title: "Google Meet link", a: <input className={inputClass} type="url" placeholder="https://meet.google.com/..." value={fieldA} onChange={(e) => setFieldA(e.target.value)} /> },
    appointment: {
      title: "Schedule a call",
      a: <input className={inputClass} type="date" value={fieldA} onChange={(e) => setFieldA(e.target.value)} aria-label="Date" />,
      b: <input className={inputClass} type="text" placeholder="Time and timezone, e.g. 4:00 PM IST" value={fieldB} onChange={(e) => setFieldB(e.target.value)} />,
    },
    document: {
      title: "Share a document",
      a: <input className={inputClass} type="text" placeholder="Title" value={fieldA} onChange={(e) => setFieldA(e.target.value)} />,
      b: <input className={inputClass} type="url" placeholder="https://..." value={fieldB} onChange={(e) => setFieldB(e.target.value)} />,
    },
    payment: {
      title: "Payment update",
      a: <input className={inputClass} type="text" placeholder="Amount or invoice reference" value={fieldA} onChange={(e) => setFieldA(e.target.value)} />,
      b: (
        <select className={inputClass} value={fieldB} onChange={(e) => setFieldB(e.target.value)} aria-label="Status">
          <option value="">Invoice shared</option>
          <option value="Payment received">Payment received</option>
          <option value="Payment pending">Payment pending</option>
        </select>
      ),
    },
    lead_request: {
      title: "Request more leads",
      a: <input className={inputClass} type="number" min={1} max={500} placeholder="How many accounts?" value={fieldA} onChange={(e) => setFieldA(e.target.value)} />,
    },
  };

  const options = ATTACH_OPTIONS.filter((o) => o.roles.includes(role));

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
      {mode !== "text" && (
        <div className="mb-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{fields[mode].title}</span>
            <button type="button" onClick={() => setMode("text")} aria-label="Cancel attachment"
              className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fields[mode].a}
            {fields[mode].b}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Attach" aria-expanded={menuOpen}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800">
            <Paperclip className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute bottom-12 left-0 z-30 w-52 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
              {options.map((o) => (
                <button key={o.mode} type="button" role="menuitem"
                  onClick={() => { setMode(o.mode); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textRef}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Message #${channelName}`}
          aria-label="Message"
          className="flex-1 resize-none rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 max-h-40"
        />

        <button type="button" onClick={() => void submit()} disabled={sending || disabled} aria-label="Send"
          className="w-10 h-10 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center justify-center">
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="hidden sm:block mt-1 pl-12 text-[10px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}
