import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyLakh(value: number): string {
  if (value >= 100) {
    return `₹${(value / 100).toFixed(1)} Cr`;
  }
  return `₹${value.toFixed(1)}L`;
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString?: string | null, referenceTime?: number): string {
  if (!dateString) return "just now";
  try {
    const date = new Date(dateString);
    const nowMs = referenceTime || (typeof window !== "undefined" ? Date.now() : 1776470400000);
    const diffMs = nowMs - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "recent";
  }
}
