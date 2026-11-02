"use client";

import React, { useState, useEffect } from "react";

interface CompanyFaviconProps {
  domain?: string | null;
  name?: string | null;
  size?: string;
  className?: string;
}

export function extractCleanCompanyDomain(raw?: string | null): string {
  if (!raw) return "";
  let cleaned = String(raw).trim().toLowerCase();
  if (cleaned.includes("@")) {
    cleaned = cleaned.split("@").pop() || "";
  }
  cleaned = cleaned
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .split(":")[0]
    .trim();

  // Only treat as valid domain if it contains a dot and isn't a placeholder word
  if (
    !cleaned ||
    !cleaned.includes(".") ||
    cleaned === "workspace" ||
    cleaned === "client" ||
    cleaned === "localhost"
  ) {
    return "";
  }
  return cleaned;
}

export function CompanyFavicon({
  domain,
  name = "Company",
  size = "w-8 h-8",
  className = "",
}: CompanyFaviconProps) {
  const cleanDomain = extractCleanCompanyDomain(domain);
  const [providerIdx, setProviderIdx] = useState<number>(0);

  useEffect(() => {
    setProviderIdx(0);
  }, [cleanDomain]);

  const displayName = name || cleanDomain || "Company";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "CO";

  const sources = cleanDomain
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(cleanDomain)}.ico`,
      ]
    : [];

  if (cleanDomain && providerIdx < sources.length) {
    return (
      <div
        title={`${displayName} (${cleanDomain})`}
        className={`relative ${size} shrink-0 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center p-1 ${className}`}
      >
        <img
          src={sources[providerIdx]}
          alt={`${displayName} domain icon`}
          className="w-full h-full object-contain rounded-xs"
          onError={() => setProviderIdx((prev) => prev + 1)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      title={displayName}
      className={`relative ${size} shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 font-mono shadow-2xs ${className}`}
    >
      {initials}
    </div>
  );
}
