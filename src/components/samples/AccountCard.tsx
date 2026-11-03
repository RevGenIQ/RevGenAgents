"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { CompanyFavicon } from "@/components/ui/CompanyFavicon";
import type { AccountSignal, RunAccount, SignalBuckets } from "@/lib/accounts/runAccount";

const SIGNAL_LABEL: Record<keyof SignalBuckets, string> = {
  icp: "ICP signals",
  hiring: "Hiring",
  funding_partnership: "Funding & partnerships",
  news: "News",
  social: "Social",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Fact({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5 min-w-0">
        {value ? <span className="truncate">{value}</span> : <span className="text-slate-400">Not found</span>}
        {value && source && /^https?:\/\//.test(source) && (
          <a href={source} target="_blank" rel="noreferrer noopener" title={`Source: ${hostOf(source)}`}
            className="shrink-0 text-slate-400 hover:text-indigo-600" aria-label={`${label} source`}>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </dd>
    </div>
  );
}

function SignalRow({ s }: { s: AccountSignal }) {
  return (
    <li className="flex gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="shrink-0 w-[76px] text-xs text-slate-500 pt-0.5">{s.date}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-900 dark:text-slate-100">{s.title}</p>
        <a href={s.url} target="_blank" rel="noreferrer noopener" className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          {hostOf(s.url)} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </li>
  );
}

/** Full research card for one account: firmographics with sources, signals, fit and pitch, contacts. */
export function AccountCard({ account: a }: { account: RunAccount }) {
  const src = (k: string) => a.sources[k]?.sourceUrl;
  const groups = (Object.keys(SIGNAL_LABEL) as Array<keyof SignalBuckets>).filter((k) => a.signals[k].length > 0);

  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyFavicon domain={a.domain} name={a.name} size="w-11 h-11" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{a.name}</h3>
            <a href={`https://${a.domain}`} target="_blank" rel="noreferrer noopener" className="text-xs text-slate-500 hover:text-indigo-600">{a.domain}</a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {a.icpScore !== null && (
            <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">ICP score {a.icpScore}</span>
          )}
          {a.priority && <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">{a.priority}</span>}
          {a.dataConfidence !== null && (
            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">Data {a.dataConfidence}%</span>
          )}
        </div>
      </header>

      <div className="p-5 space-y-6">
        {a.description && <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{a.description}</p>}

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
          <Fact label="Industry" value={a.industry} source={src("industry")} />
          <Fact label="Employees" value={a.employees} source={src("employeeCount")} />
          <Fact label="Headquarters" value={a.hqLocation || [a.city, a.country].filter(Boolean).join(", ")} source={src("hqLocation") || src("country")} />
          <Fact label="Founded" value={a.foundedYear} source={src("foundedYear")} />
          <Fact label="Company type" value={a.companyType} source={src("companyType")} />
          <Fact label="Revenue" value={a.revenue} source={src("annualRevenue")} />
          <Fact label="Total funding" value={a.totalFunding} source={src("totalFunding")} />
          <Fact label="Latest round" value={[a.latestFundingRound, a.latestFundingAmount, a.lastRaisedAt].filter(Boolean).join(" · ")} source={src("latestFundingRound")} />
          <Fact label="NAICS" value={a.naics.replace(/^NAICS\s*/, "")} />
          <Fact label="SIC" value={a.sic.replace(/^SIC Division\s*/, "")} />
          <Fact label="LinkedIn" value={a.linkedinUrl ? "Company page" : ""} source={a.linkedinUrl} />
          <Fact label="Email / phone" value={a.emailPhone} source={src("email") || src("phone")} />
        </dl>

        {a.techStack.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500">Tech stack (detected on their website)</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.techStack.map((t) => (
                <span key={t} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">{t}</span>
              ))}
            </div>
          </div>
        )}

        {(a.whyIcpFit || a.whatToPitch) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {a.whyIcpFit && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/50 p-4">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Why they fit your ICP</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{a.whyIcpFit}</p>
              </div>
            )}
            {a.whatToPitch && (
              <div className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 p-4">
                <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">What to pitch</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{a.whatToPitch}</p>
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="text-xs font-medium text-slate-500">Buying signals ({a.totalSignals}), each with its source</h4>
          {groups.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No dated signals were found for this account.</p>
          ) : (
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              {groups.map((g) => (
                <section key={g}>
                  <h5 className="text-sm font-medium text-slate-900 dark:text-white">{SIGNAL_LABEL[g]}</h5>
                  <ul className="mt-1">{a.signals[g].map((s) => <SignalRow key={s.url + s.title} s={s} />)}</ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {a.contacts.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500">Contacts found</h4>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {a.contacts.map((c, i) => (
                <li key={i} className="py-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-slate-900 dark:text-white">{String(c.name || "")}<span className="text-slate-500"> · {String(c.title || "")}</span></span>
                  <span className="text-xs text-slate-500">{String(c.verificationStatus || "").replace(/[✓⚠]\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
