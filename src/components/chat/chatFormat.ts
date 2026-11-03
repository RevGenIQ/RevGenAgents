/**
 * Pure helpers for the workspace channel: who sent a message, day separators
 * and grouping of consecutive messages from the same sender.
 */

import type { WorkspaceChatMessage } from "@/lib/store/osWorkflowStore";

export type ChatRole = "admin" | "humagent" | "client";

/** Messages from the same sender within this window share one bubble group. */
const GROUP_WINDOW_MS = 5 * 60_000;

export const ROLE_LABEL: Record<WorkspaceChatMessage["senderRole"], string> = {
  admin: "Admin",
  humagent: "Humagent",
  client: "Client",
  system: "RevGen IQ",
};

export function isOwnMessage(msg: WorkspaceChatMessage, role: ChatRole, email: string): boolean {
  if (msg.senderRole !== role) return false;
  // Admin and humagent emails identify the person; a client workspace may have several spokespeople.
  return !email || (msg.senderEmail || "").toLowerCase() === email.toLowerCase();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", a weekday within the last week, else a short date. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export interface ThreadItem {
  kind: "day" | "message";
  key: string;
  label?: string;
  message?: WorkspaceChatMessage;
  /** First message of a run from one sender: shows the sender's name. */
  startsGroup?: boolean;
  /** Last message of a run: gets the bubble tail and timestamp spacing. */
  endsGroup?: boolean;
}

/** Interleaves day separators and marks where each sender's run of messages starts and ends. */
export function buildThread(messages: WorkspaceChatMessage[], now: Date = new Date()): ThreadItem[] {
  const sameGroup = (a?: WorkspaceChatMessage, b?: WorkspaceChatMessage) =>
    !!a &&
    !!b &&
    a.senderRole !== "system" &&
    a.senderRole === b.senderRole &&
    (a.senderEmail || a.senderName) === (b.senderEmail || b.senderName) &&
    startOfDay(new Date(a.createdAt)) === startOfDay(new Date(b.createdAt)) &&
    Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <= GROUP_WINDOW_MS;

  return messages.flatMap((message, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const newDay = !prev || startOfDay(new Date(prev.createdAt)) !== startOfDay(new Date(message.createdAt));
    const separator: ThreadItem[] = newDay
      ? [{ kind: "day", key: `day-${message.createdAt.slice(0, 10)}-${i}`, label: dayLabel(message.createdAt, now) }]
      : [];
    return [
      ...separator,
      {
        kind: "message" as const,
        key: message.id,
        message,
        startsGroup: !sameGroup(prev, message),
        endsGroup: !sameGroup(message, next),
      },
    ];
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}
