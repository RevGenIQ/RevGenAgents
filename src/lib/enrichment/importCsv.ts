/**
 * Parses a Humagent's enriched delivery CSV into a staged payload: company
 * column updates, contacts, and any extra context columns, keyed by domain.
 * Nothing is written here; the Admin's approval applies the payload.
 */

import { COMPANY_COLUMNS, CONTACT_COLUMNS, SIGNAL_COLUMNS, parseCsv, uncsvCell } from "../accounts/csv";
import { firstInteger, isoDateOrNull, usdAmount } from "../agents/repo/companyColumns";

export const MAX_IMPORT_ROWS = 2000;
const REQUIRED_HEADERS = ["Company_Name", "Company_Website"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StagedContact {
  domain: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  emailStatus: string;
  workDirectPhone: string;
  mobilePhone: string;
  seniority: string;
  department: string;
  subDepartment: string;
  linkedinUrl: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export interface StagedCompany {
  domain: string;
  name: string;
  /** `companies` columns to update (only non-empty cells). */
  columns: Record<string, unknown>;
  /** Columns outside the delivery spec, kept as extra context. */
  extra: Record<string, string>;
}

export interface EnrichmentPayload {
  companies: StagedCompany[];
  contacts: StagedContact[];
  warnings: string[];
}

export type ImportResult = { ok: true; payload: EnrichmentPayload } | { ok: false; error: string };

/** "https://www.acme.com/about" -> "acme.com". */
export function domainOf(website: string): string {
  const raw = website.trim().toLowerCase();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Company CSV header -> companies column, with the value parsed for typed columns. */
const COMPANY_MAP: Record<string, (v: string) => Record<string, unknown>> = {
  "Company Linkedin Url": (v) => ({ linkedin_url: v, company_linkedin: v }),
  "Facebook Url": (v) => ({ facebook_url: v }),
  "Twitter Url": (v) => ({ twitter_url: v }),
  Company_Number: (v) => ({ company_number: v }),
  Company_Email_Phone: (v) => ({ company_email_phone: v }),
  Employee_Count: (v) => ({ employee_count_band: v, employee_count: firstInteger(v) }),
  Company_Industry: (v) => ({ industry: v }),
  Tech_Stack: (v) => ({ tech_stack: v.split(/\s*,\s*/).filter(Boolean) }),
  Company_Type: (v) => ({ company_type: v }),
  Keywords: (v) => ({ company_keywords: v }),
  Founded_Year: (v) => {
    const y = firstInteger(v);
    return y && y > 1700 && y <= new Date().getUTCFullYear() ? { founded_year: y } : {};
  },
  "SIC Codes": (v) => ({ sic_codes: v }),
  "NAICS Codes": (v) => ({ naics_codes: v }),
  "Company City": (v) => ({ company_city: v }),
  "Company State": (v) => ({ company_state: v }),
  "Company Country": (v) => ({ company_country: v }),
  HQ_Location: (v) => ({ hq_location: v }),
  "Annual Revenue": (v) => ({ company_revenue: v }),
  "Total Funding": (v) => {
    const usd = usdAmount(v);
    return usd === null ? {} : { total_funding_usd: usd };
  },
  "Latest Funding": (v) => ({ latest_funding: v }),
  "Latest Funding Amount": (v) => ({ latest_funding_amount: v }),
  "Last Raised At": (v) => {
    const d = isoDateOrNull(v);
    return d ? { last_raised_at: d } : {};
  },
  Company_Description: (v) => ({ company_description: v }),
  Priority: (v) => ({ priority_band: v }),
  Why_ICP_Fit: (v) => ({ why_icp_fit: v }),
  What_To_Pitch: (v) => ({ what_to_pitch: v }),
};

/** Columns that are agent output or computed and are not overwritten from a CSV. */
const READ_ONLY = new Set<string>([
  "Company_Name",
  "Company_Website",
  "Data_Confidence",
  "Total_Targeted_Signals",
  "ICP_Score",
  ...SIGNAL_COLUMNS.filter((c) => c.endsWith("Signal") || c.endsWith("Source")),
]);
const KNOWN = new Set<string>([...COMPANY_COLUMNS, ...SIGNAL_COLUMNS, ...CONTACT_COLUMNS]);
const isIcpSignalColumn = (h: string) => /_Signal(_Source)?$/.test(h);

function contactFrom(cell: (h: string) => string, domain: string): StagedContact | null {
  const c: StagedContact = {
    domain,
    firstName: cell("First Name"),
    lastName: cell("Last Name"),
    title: cell("Title"),
    email: cell("Email").toLowerCase(),
    emailStatus: cell("Email Status"),
    workDirectPhone: cell("Work Direct Phone"),
    mobilePhone: cell("Mobile Phone"),
    seniority: cell("Seniority"),
    department: cell("Departments"),
    subDepartment: cell("Sub Departments"),
    linkedinUrl: cell("Person Linkedin Url"),
    address: cell("Address"),
    city: cell("City"),
    state: cell("State"),
    country: cell("Country"),
  };
  return c.firstName || c.lastName || c.email ? c : null;
}

export function parseEnrichmentCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: "The file has no data rows." };
  const headers = rows[0].map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) return { ok: false, error: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  if (rows.length - 1 > MAX_IMPORT_ROWS) return { ok: false, error: `Too many rows (max ${MAX_IMPORT_ROWS}).` };

  const warnings: string[] = [];
  const companies = new Map<string, StagedCompany>();
  const contacts: StagedContact[] = [];

  rows.slice(1).forEach((row, i) => {
    const cell = (h: string) => {
      const idx = headers.indexOf(h);
      return idx < 0 ? "" : uncsvCell(String(row[idx] ?? "")).trim().slice(0, 2000);
    };
    const domain = domainOf(cell("Company_Website"));
    if (!domain) {
      warnings.push(`Row ${i + 2}: no valid Company_Website, skipped.`);
      return;
    }
    const existing = companies.get(domain) || { domain, name: cell("Company_Name") || domain, columns: {}, extra: {} };
    const columns = { ...existing.columns };
    const extra = { ...existing.extra };
    headers.forEach((h) => {
      const v = cell(h);
      if (!v || READ_ONLY.has(h)) return;
      if (COMPANY_MAP[h]) Object.assign(columns, COMPANY_MAP[h](v));
      else if (!KNOWN.has(h) && !isIcpSignalColumn(h)) extra[h] = v;
    });
    companies.set(domain, { ...existing, columns, extra });

    const contact = contactFrom(cell, domain);
    if (contact) {
      if (contact.email && !EMAIL.test(contact.email)) {
        warnings.push(`Row ${i + 2}: "${contact.email}" is not a valid email; the email was dropped.`);
        contacts.push({ ...contact, email: "" });
      } else {
        contacts.push(contact);
      }
    }
  });

  if (companies.size === 0) return { ok: false, error: "No rows had a valid Company_Website." };
  return { ok: true, payload: { companies: [...companies.values()], contacts, warnings: warnings.slice(0, 50) } };
}
