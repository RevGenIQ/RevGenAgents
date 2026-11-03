/**
 * The delivery CSV: the company columns the agent researches, one pair of
 * columns per ICP signal, the five targeted-signal pairs, scoring, then the
 * contact columns a Humagent fills in (one row per contact, default 3 per
 * account). Cells are written formula-safe and parsed back losslessly.
 */

import type { AccountSignal, RunAccount } from "./runAccount";

export const COMPANY_COLUMNS = [
  "Company_Name",
  "Company_Website",
  "Company Linkedin Url",
  "Facebook Url",
  "Twitter Url",
  "Company_Number",
  "Company_Email_Phone",
  "Employee_Count",
  "Company_Industry",
  "Tech_Stack",
  "Company_Type",
  "Keywords",
  "Founded_Year",
  "SIC Codes",
  "NAICS Codes",
  "Company City",
  "Company State",
  "Company Country",
  "HQ_Location",
  "Annual Revenue",
  "Total Funding",
  "Latest Funding",
  "Latest Funding Amount",
  "Last Raised At",
  "Company_Description",
  "Data_Confidence",
  "Total_Targeted_Signals",
] as const;

export const SIGNAL_COLUMNS = [
  "ICP_Signal",
  "ICP_Signal_Source",
  "Hiring_Signal",
  "Hiring_Signal_Source",
  "Funding_Partnership_Signal",
  "Funding_Partnership_Source",
  "News_Article_Signal",
  "News_Article_Source",
  "Social_Media_Signal",
  "Social_Media_Source",
  "ICP_Score",
  "Priority",
  "Why_ICP_Fit",
  "What_To_Pitch",
] as const;

export const CONTACT_COLUMNS = [
  "Number of Contacts",
  "First Name",
  "Last Name",
  "Title",
  "Email",
  "Email Status",
  "Work Direct Phone",
  "Mobile Phone",
  "Seniority",
  "Departments",
  "Sub Departments",
  "Person Linkedin Url",
  "Address",
  "City",
  "State",
  "Country",
] as const;

export const DEFAULT_CONTACTS_PER_ACCOUNT = 3;

/** "Hiring for sales" -> "Hiring_For_Sales_Signal" / "..._Source". */
export function icpSignalColumns(requiredSignals: string[]): string[] {
  return requiredSignals.flatMap((s) => {
    const base = s
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("_");
    return base ? [`${base}_Signal`, `${base}_Signal_Source`] : [];
  });
}

export function deliveryHeaders(requiredSignals: string[], includeContacts: boolean): string[] {
  return [...COMPANY_COLUMNS, ...icpSignalColumns(requiredSignals), ...SIGNAL_COLUMNS, ...(includeContacts ? CONTACT_COLUMNS : [])];
}

function signalCells(list: AccountSignal[]): [string, string] {
  return [
    list.map((s) => `${s.title}${s.date ? ` (${s.date})` : ""}`).join(" | "),
    list.map((s) => s.url).join(" | "),
  ];
}

function matchesTerm(s: AccountSignal, term: string): boolean {
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const hay = `${s.type} ${s.title}`.toLowerCase();
  return words.length > 0 && words.some((w) => hay.includes(w));
}

/** Company and signal cells for one account, keyed by header. */
export function accountCells(a: RunAccount, requiredSignals: string[]): Record<string, string> {
  const all = Object.values(a.signals).flat();
  const src = (k: string) => a.sources[k]?.value || "";
  const icpPairs = requiredSignals.flatMap((term) => {
    const names = icpSignalColumns([term]);
    if (names.length === 0) return [];
    const [text, url] = signalCells(all.filter((s) => matchesTerm(s, term)));
    return [[names[0], text], [names[1], url]] as Array<[string, string]>;
  });
  const [icpT, icpU] = signalCells(a.signals.icp);
  const [hirT, hirU] = signalCells(a.signals.hiring);
  const [funT, funU] = signalCells(a.signals.funding_partnership);
  const [newT, newU] = signalCells(a.signals.news);
  const [socT, socU] = signalCells(a.signals.social);

  return {
    Company_Name: a.name,
    Company_Website: a.domain ? `https://${a.domain}` : "",
    "Company Linkedin Url": a.linkedinUrl,
    "Facebook Url": a.facebookUrl,
    "Twitter Url": a.twitterUrl,
    Company_Number: src("phone"),
    Company_Email_Phone: a.emailPhone,
    Employee_Count: a.employees,
    Company_Industry: a.industry,
    Tech_Stack: a.techStack.join(", "),
    Company_Type: a.companyType,
    Keywords: a.keywords,
    Founded_Year: a.foundedYear,
    "SIC Codes": a.sic,
    "NAICS Codes": a.naics,
    "Company City": a.city,
    "Company State": a.state,
    "Company Country": a.country,
    HQ_Location: a.hqLocation,
    "Annual Revenue": a.revenue,
    "Total Funding": a.totalFunding,
    "Latest Funding": a.latestFundingRound,
    "Latest Funding Amount": a.latestFundingAmount,
    "Last Raised At": a.lastRaisedAt,
    Company_Description: a.description,
    Data_Confidence: a.dataConfidence === null ? "" : `${a.dataConfidence}%`,
    Total_Targeted_Signals: String(a.totalSignals),
    ...Object.fromEntries(icpPairs),
    ICP_Signal: icpT,
    ICP_Signal_Source: icpU,
    Hiring_Signal: hirT,
    Hiring_Signal_Source: hirU,
    Funding_Partnership_Signal: funT,
    Funding_Partnership_Source: funU,
    News_Article_Signal: newT,
    News_Article_Source: newU,
    Social_Media_Signal: socT,
    Social_Media_Source: socU,
    ICP_Score: a.icpScore === null ? "" : String(a.icpScore),
    Priority: a.priority,
    Why_ICP_Fit: a.whyIcpFit,
    What_To_Pitch: a.whatToPitch,
    ...a.extraContext,
  };
}

/** Phone numbers and signed numbers start with + or - but cannot carry a formula. */
const NUMERIC_ONLY = /^[+-][\d\s().-]*$/;

/** Quotes a cell and neutralises spreadsheet formula prefixes (CSV injection). */
export function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) && !NUMERIC_ONLY.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(headers: string[], rows: Array<Record<string, string>>): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h] ?? "")).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export interface CsvOptions {
  requiredSignals: string[];
  /** Adds the contact columns: one row per known contact, padded with blank rows up to contactsPerAccount. */
  includeContacts: boolean;
  contactsPerAccount?: number;
  /** Extra context columns a Humagent added, kept on export. */
  extraHeaders?: string[];
}

function contactCells(c: Record<string, unknown> | undefined, count: number): Record<string, string> {
  const s = (k: string) => (c && c[k] !== undefined && c[k] !== null ? String(c[k]) : "");
  const [first = "", ...rest] = s("name").split(" ");
  return {
    "Number of Contacts": String(count),
    "First Name": s("firstName") || first,
    "Last Name": s("lastName") || rest.join(" "),
    Title: s("title"),
    Email: s("email"),
    "Email Status": s("emailStatus") || s("verificationStatus"),
    "Work Direct Phone": s("workDirectPhone") || s("phone"),
    "Mobile Phone": s("mobilePhone"),
    Seniority: s("seniority"),
    Departments: s("department"),
    "Sub Departments": s("subDepartment"),
    "Person Linkedin Url": s("linkedinUrl"),
    Address: s("address"),
    City: s("city"),
    State: s("state"),
    Country: s("country") || s("location"),
  };
}

export function accountsToCsv(accounts: RunAccount[], opts: CsvOptions): string {
  const perAccount = Math.max(1, opts.contactsPerAccount ?? DEFAULT_CONTACTS_PER_ACCOUNT);
  const extra = (opts.extraHeaders || []).filter((h) => !deliveryHeaders(opts.requiredSignals, true).includes(h));
  const headers = [...deliveryHeaders(opts.requiredSignals, opts.includeContacts), ...extra];
  const rows = accounts.flatMap((a) => {
    const company = accountCells(a, opts.requiredSignals);
    if (!opts.includeContacts) return [company];
    const count = Math.max(perAccount, a.contacts.length);
    return Array.from({ length: count }, (_, i) => ({ ...company, ...contactCells(a.contacts[i], count) }));
  });
  return toCsv(headers, rows);
}

/** RFC 4180 parser (quoted fields, escaped quotes, CRLF/LF, BOM). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Undoes csvCell's formula guard on import. */
export function uncsvCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}
