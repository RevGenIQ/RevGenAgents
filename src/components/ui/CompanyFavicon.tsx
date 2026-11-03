"use client";

import React, { useState } from "react";

export type CompanyFaviconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface CompanyFaviconProps {
  domain?: string | null;
  name?: string | null;
  /** Direct logo image to try before the domain favicon providers. */
  logoUrl?: string | null;
  /**
   * Typed size token. Legacy Tailwind class strings such as `"w-8 h-8"` are
   * still accepted and mapped to the nearest token.
   */
  size?: CompanyFaviconSize | (string & {});
  className?: string;
}

const SIZE_STYLES: Record<
  CompanyFaviconSize,
  { px: number; padding: number; radius: number; fontSize: number }
> = {
  xs: { px: 16, padding: 1, radius: 4, fontSize: 7 },
  sm: { px: 20, padding: 2, radius: 5, fontSize: 8 },
  md: { px: 28, padding: 3, radius: 6, fontSize: 10 },
  lg: { px: 40, padding: 4, radius: 8, fontSize: 13 },
  xl: { px: 56, padding: 6, radius: 10, fontSize: 17 },
};

const SIZE_ORDER = Object.keys(SIZE_STYLES) as CompanyFaviconSize[];

function isSizeToken(value: string): value is CompanyFaviconSize {
  return (SIZE_ORDER as string[]).includes(value);
}

/** Maps a legacy `w-N` / `h-N` class string to the nearest size token. */
export function resolveFaviconSize(size?: string | null): CompanyFaviconSize {
  if (!size) return "md";
  if (isSizeToken(size)) return size;
  const match = size.match(/(?:^|\s)(?:w|h|size)-(\d+(?:\.\d+)?)(?:\s|$)/);
  if (!match) return "md";
  const px = parseFloat(match[1]) * 4;
  return SIZE_ORDER.reduce((best, token) =>
    Math.abs(SIZE_STYLES[token].px - px) < Math.abs(SIZE_STYLES[best].px - px)
      ? token
      : best
  );
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

function initialsFor(displayName: string): string {
  return (
    displayName
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "CO"
  );
}

export function CompanyFavicon({
  domain,
  name = "Company",
  logoUrl,
  size,
  className = "",
}: CompanyFaviconProps) {
  const cleanDomain = extractCleanCompanyDomain(domain);
  // Remembering failed URLs (rather than an index) means a new domain or logo
  // starts fresh without resetting state in an effect.
  const [failedSources, setFailedSources] = useState<readonly string[]>([]);

  const displayName = name || cleanDomain || "Company";
  const token = resolveFaviconSize(size);
  const metrics = SIZE_STYLES[token];
  const boxStyle: React.CSSProperties = {
    width: metrics.px,
    height: metrics.px,
    borderRadius: metrics.radius,
  };

  const sources = [
    ...(logoUrl ? [logoUrl] : []),
    ...(cleanDomain
      ? [
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`,
          `https://icons.duckduckgo.com/ip3/${encodeURIComponent(cleanDomain)}.ico`,
        ]
      : []),
  ];

  const activeSource = sources.find((src) => !failedSources.includes(src));

  if (activeSource) {
    return (
      <div
        title={cleanDomain ? `${displayName} (${cleanDomain})` : displayName}
        data-size={token}
        style={{ ...boxStyle, padding: metrics.padding }}
        className={`relative shrink-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center ${className}`}
      >
        {/* External favicon hosts; next/image would need a remotePatterns entry per provider. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSource}
          alt={`${displayName} logo`}
          width={metrics.px}
          height={metrics.px}
          className="block w-full h-full object-contain"
          onError={() => setFailedSources((prev) => [...prev, activeSource])}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      title={displayName}
      data-size={token}
      style={{ ...boxStyle, fontSize: metrics.fontSize }}
      className={`relative shrink-0 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold font-mono leading-none text-indigo-600 dark:text-indigo-400 ${className}`}
    >
      {token === "xs" ? initialsFor(displayName).slice(0, 1) : initialsFor(displayName)}
    </div>
  );
}
