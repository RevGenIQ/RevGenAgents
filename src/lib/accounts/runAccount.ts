/**
 * The account shape the live research grid, results cards, CSV export and PDF
 * all render. One mapper from `companies` rows keeps them consistent.
 */

export const RUN_ACCOUNT_COLUMNS = [
  "id",
  "run_id",
  "company_name",
  "canonical_domain",
  "research_status",
  "delivery_stage",
  "industry",
  "company_type",
  "employee_count_band",
  "employee_count",
  "founded_year",
  "company_city",
  "company_state",
  "company_country",
  "hq_location",
  "linkedin_url",
  "facebook_url",
  "twitter_url",
  "company_email_phone",
  "company_keywords",
  "tech_stack",
  "company_revenue",
  "total_funding_usd",
  "latest_funding",
  "latest_funding_amount",
  "last_raised_at",
  "naics_codes",
  "sic_codes",
  "company_description",
  "overview",
  "data_confidence",
  "total_targeted_signals",
  "signals_json",
  "icp_score",
  "priority_band",
  "why_icp_fit",
  "what_to_pitch",
  "icp_fit_reason",
  "field_sources_json",
  "extra_context_json",
  "contacts_json",
  "updated_at",
].join(", ");

export interface AccountSignal {
  title: string;
  quote: string;
  url: string;
  date: string;
  type: string;
}

export type SignalBuckets = Record<"icp" | "hiring" | "funding_partnership" | "news" | "social", AccountSignal[]>;

export interface RunAccount {
  id: string;
  name: string;
  domain: string;
  status: "queued" | "researching" | "done";
  stage: string;
  industry: string;
  companyType: string;
  employees: string;
  foundedYear: string;
  city: string;
  state: string;
  country: string;
  hqLocation: string;
  linkedinUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  emailPhone: string;
  keywords: string;
  techStack: string[];
  revenue: string;
  totalFunding: string;
  latestFundingRound: string;
  latestFundingAmount: string;
  lastRaisedAt: string;
  naics: string;
  sic: string;
  description: string;
  dataConfidence: number | null;
  totalSignals: number;
  signals: SignalBuckets;
  icpScore: number | null;
  priority: string;
  whyIcpFit: string;
  whatToPitch: string;
  reason: string;
  sources: Record<string, { value?: string; sourceUrl?: string; method?: string }>;
  extraContext: Record<string, string>;
  contacts: Array<Record<string, unknown>>;
  updatedAt: string;
}

const EMPTY_BUCKETS: SignalBuckets = { icp: [], hiring: [], funding_partnership: [], news: [], social: [] };

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function usd(v: unknown): string {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return "";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function buckets(v: unknown): SignalBuckets {
  const raw = record(v);
  return Object.fromEntries(
    Object.keys(EMPTY_BUCKETS).map((k) => [k, Array.isArray(raw[k]) ? (raw[k] as AccountSignal[]) : []])
  ) as SignalBuckets;
}

export function mapRunAccount(row: Record<string, unknown>): RunAccount {
  const status = str(row.research_status);
  const score = Number(row.icp_score);
  const confidence = Number(row.data_confidence);
  return {
    id: str(row.id),
    name: str(row.company_name),
    domain: str(row.canonical_domain),
    status: status === "queued" || status === "researching" ? status : "done",
    stage: str(row.delivery_stage),
    industry: str(row.industry),
    companyType: str(row.company_type),
    employees: str(row.employee_count_band) || str(row.employee_count),
    foundedYear: str(row.founded_year),
    city: str(row.company_city),
    state: str(row.company_state),
    country: str(row.company_country),
    hqLocation: str(row.hq_location),
    linkedinUrl: str(row.linkedin_url),
    facebookUrl: str(row.facebook_url),
    twitterUrl: str(row.twitter_url),
    emailPhone: str(row.company_email_phone),
    keywords: str(row.company_keywords),
    techStack: Array.isArray(row.tech_stack) ? (row.tech_stack as unknown[]).map(str).filter(Boolean) : [],
    revenue: str(row.company_revenue),
    totalFunding: usd(row.total_funding_usd) || str(record(record(row.field_sources_json).totalFunding).value),
    latestFundingRound: str(row.latest_funding),
    latestFundingAmount: str(row.latest_funding_amount),
    lastRaisedAt: str(row.last_raised_at),
    naics: str(row.naics_codes),
    sic: str(row.sic_codes),
    description: str(row.company_description) || str(row.overview),
    dataConfidence: Number.isFinite(confidence) && row.data_confidence !== null ? confidence : null,
    totalSignals: Number(row.total_targeted_signals) || 0,
    signals: buckets(row.signals_json),
    icpScore: Number.isFinite(score) && row.icp_score !== null ? score : null,
    priority: str(row.priority_band),
    whyIcpFit: str(row.why_icp_fit),
    whatToPitch: str(row.what_to_pitch),
    reason: str(row.icp_fit_reason).replace(/^\[Origin: LangGraph run\]\s*/, ""),
    sources: record(row.field_sources_json) as RunAccount["sources"],
    extraContext: Object.fromEntries(Object.entries(record(row.extra_context_json)).map(([k, v]) => [k, str(v)])),
    contacts: Array.isArray(row.contacts_json) ? (row.contacts_json as Array<Record<string, unknown>>) : [],
    updatedAt: str(row.updated_at),
  };
}
