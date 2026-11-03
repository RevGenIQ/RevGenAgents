"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Marquee } from "@/components/ui/Marquee";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import type {
  PublicIntentItem,
  PublicIntentPlatform,
  PublicIntentPlatformId,
} from "@/app/api/public-intent/route";

const REFRESH_INTERVAL_MS = 45_000;
const MAX_CARDS_PER_ROW = 6;

/** Row order, copy and loop speed (seconds per loop) for each source. */
const ROWS: ReadonlyArray<{
  id: PublicIntentPlatformId;
  label: string;
  descriptor: string;
  durationSeconds: number;
}> = [
  { id: "producthunt", label: "Product Hunt", descriptor: "Launches", durationSeconds: 58 },
  { id: "hackernews", label: "Hacker News", descriptor: "Hiring", durationSeconds: 66 },
  { id: "devto", label: "dev.to", descriptor: "Stack shifts", durationSeconds: 52 },
];

const CARD_CLASS = "w-[280px] sm:w-[312px] h-[176px] shrink-0";

function IntentCard({ item }: { item: PublicIntentItem }) {
  return (
    <article
      className={`${CARD_CLASS} group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400`}
    >
      <header className="flex items-center gap-3 min-w-0">
        <CompanyFavicon
          domain={item.domain}
          logoUrl={item.logoUrl}
          name={item.company}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none group-focus-within:underline"
            >
              {item.company}
            </a>
          </h3>
          <p className="truncate text-[11px] font-mono text-slate-500">
            {item.domain || item.category}
          </p>
        </div>
        <span
          className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-mono font-semibold tabular-nums text-slate-700"
          title="Intent score"
        >
          {item.intentScore}
        </span>
      </header>

      <p className="mt-3 line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">
        {item.title}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.summary}</p>

      <footer className="mt-auto flex items-center justify-between pt-3 text-[11px] font-mono text-slate-500">
        <span className="uppercase tracking-wide">{item.signalType}</span>
        <span className="flex items-center gap-3">
          <a
            href={item.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 text-slate-500 hover:text-[#0A66C2]"
            title={`Find ${item.company} on LinkedIn`}
          >
            LinkedIn
          </a>
          <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
        </span>
      </footer>
    </article>
  );
}

function PlaceholderCards({ count }: { count: number }) {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className={`${CARD_CLASS} rounded-xl border border-dashed border-slate-200 bg-white/60`}
        />
      ))}
    </div>
  );
}

function PlatformRow({
  label,
  descriptor,
  durationSeconds,
  items,
  isLoading,
}: {
  label: string;
  descriptor: string;
  durationSeconds: number;
  items: PublicIntentItem[];
  isLoading: boolean;
}) {
  const cards = items.slice(0, MAX_CARDS_PER_ROW);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3 px-4 sm:px-6 lg:px-8">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-[0.14em] text-slate-900">
          {label}
        </h3>
        <span className="text-xs text-slate-500">{descriptor}</span>
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        <span className="text-[11px] font-mono tabular-nums text-slate-400">
          {cards.length} signals
        </span>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        {cards.length > 0 ? (
          <Marquee durationSeconds={durationSeconds} ariaLabel={`${label} signals`}>
            {cards.map((item) => (
              <IntentCard key={item.id} item={item} />
            ))}
          </Marquee>
        ) : isLoading ? (
          <PlaceholderCards count={4} />
        ) : (
          <div className="flex h-[176px] items-center rounded-xl border border-dashed border-slate-200 px-5 text-xs text-slate-500">
            No live signals from {label} right now.
          </div>
        )}
      </div>
    </div>
  );
}

interface IntentSnapshot {
  platforms: PublicIntentPlatform[];
  updatedAt: string;
}

async function fetchIntentSnapshot(): Promise<IntentSnapshot | null> {
  try {
    const res = await fetch("/api/public-intent");
    if (!res.ok) return null;
    const data: { platforms?: PublicIntentPlatform[]; updatedAt?: string } =
      await res.json();
    return {
      platforms: data.platforms ?? [],
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function LiveIntentStream() {
  const [platforms, setPlatforms] = useState<PublicIntentPlatform[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(true);

  const applySnapshot = useCallback((snapshot: IntentSnapshot | null) => {
    if (snapshot) {
      setPlatforms(snapshot.platforms);
      setUpdatedAt(snapshot.updatedAt);
    }
    // On failure the last good snapshot stays on screen; the next tick retries.
    setIsRefreshing(false);
  }, []);

  const load = useCallback(
    () => fetchIntentSnapshot().then(applySnapshot),
    [applySnapshot]
  );

  useEffect(() => {
    let active = true;
    const tick = () =>
      fetchIntentSnapshot().then((snapshot) => {
        if (active) applySnapshot(snapshot);
      });
    tick();
    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [applySnapshot]);

  const itemsFor = (id: PublicIntentPlatformId) =>
    platforms.find((p) => p.id === id)?.items ?? [];

  return (
    <section id="live-intent-stream" className="relative z-10 w-full py-20">
      <div className="mx-auto mb-10 flex max-w-7xl flex-col justify-between gap-4 px-4 sm:flex-row sm:items-end sm:px-6 lg:px-8">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Live intent
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Buying signals, as they happen
          </h2>
          <p className="mt-1.5 max-w-xl text-sm text-slate-600">
            Launches, hiring and stack changes pulled from public sources. Hover a row to pause it; open any card to inspect the source.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-[11px] font-mono text-slate-400">
              Synced{" "}
              {new Date(updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              void load();
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {ROWS.map((row) => (
          <PlatformRow
            key={row.id}
            label={row.label}
            descriptor={row.descriptor}
            durationSeconds={row.durationSeconds}
            items={itemsFor(row.id)}
            isLoading={isRefreshing && platforms.length === 0}
          />
        ))}
      </div>
    </section>
  );
}
