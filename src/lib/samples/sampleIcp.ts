/**
 * The ICP a client fills in to claim the free sample. Stored as the
 * workspace's icp_brief in the shape buildIcpContext reads.
 */

import * as z from "zod";

const SAMPLE_TARGET_COUNT = 5;
/** A slightly lower bar than staff runs: the sample should show what we find, and the client can request enrichment. */
export const SAMPLE_MIN_FIT_SCORE = 60;
export { SAMPLE_TARGET_COUNT };

const list = (max: number) =>
  z
    .array(z.string().trim().min(1).max(80))
    .max(max)
    .transform((items) => [...new Set(items)]);

export const sampleIcpSchema = z.object({
  offering: z.string().trim().min(10, "Describe what you sell in a sentence or two.").max(600),
  idealCustomer: z.string().trim().max(600).default(""),
  industries: list(8).refine((v) => v.length > 0, "Add at least one target industry."),
  geographies: list(8).refine((v) => v.length > 0, "Add at least one target country or region."),
  employeeBands: list(6).default([]),
  targetTitles: list(8).default([]),
  signals: list(8).default([]),
  signalWindowDays: z.coerce.number().int().min(30).max(730).default(365),
  excludeDomains: list(50).default([]),
});

export type SampleIcp = z.infer<typeof sampleIcpSchema>;

export const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];

export const SUGGESTED_SIGNALS = [
  "Funding round",
  "Hiring for sales",
  "New product launch",
  "Expansion to new market",
  "New leadership hire",
  "Partnership",
  "Tech adoption",
];

/** workspaces.icp_brief payload (the keys buildIcpContext reads). */
export function toIcpBrief(icp: SampleIcp): Record<string, unknown> {
  return {
    offering: icp.offering,
    businessGoal: icp.idealCustomer,
    targetIndustries: icp.industries,
    geographies: icp.geographies,
    employeeBands: icp.employeeBands,
    buyerFunctions: [],
    seniorityLevels: [],
    targetTitles: icp.targetTitles,
    requiredSignals: icp.signals,
    signalWindowDays: icp.signalWindowDays,
    source: "free_sample_form",
  };
}

/** research_runs.icp_input for the one-time sample run. */
export function toSampleRunInput(icp: SampleIcp): Record<string, unknown> {
  return {
    reviewMode: "auto",
    source: "free_sample",
    targetTitles: icp.targetTitles,
    description: icp.idealCustomer || icp.offering,
    dncList: icp.excludeDomains,
  };
}
