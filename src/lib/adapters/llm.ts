/**
 * LLM Provider Adapter
 * Uses the configured LLM fallback chain (src/lib/llm); falls back to a
 * rule-based ICP when no provider answers.
 */

import * as z from "zod";
import { llmJson } from "../agents/tools/llmJson";

export interface ParsedIcpResult {
  targetIndustries: string[];
  targetCountries: string[];
  headcountRanges: string[];
  targetJobTitles: string[];
  seniorityLevels: string[];
  inferredOffering: string;
  keyPainPoints: string[];
  suggestedExclusions: string[];
  minQualificationScore: number;
}

const strings = z.array(z.string()).default([]);
const ParsedIcpSchema = z.object({
  targetIndustries: strings,
  targetCountries: strings,
  headcountRanges: strings,
  targetJobTitles: strings,
  seniorityLevels: strings,
  inferredOffering: z.string().default(""),
  keyPainPoints: strings,
  suggestedExclusions: strings,
  minQualificationScore: z.coerce.number().int().min(0).max(100).catch(80),
});

export async function parseIcpFromInput(
  websiteUrl: string,
  description: string
): Promise<ParsedIcpResult> {
  const result = await llmJson(ParsedIcpSchema, {
    system:
      "Extract a structured ICP from a company website and description. Return JSON with targetIndustries, targetCountries, headcountRanges (e.g. \"50-200\"), targetJobTitles, seniorityLevels (string arrays), inferredOffering (string), keyPainPoints, suggestedExclusions (string arrays) and minQualificationScore (integer 0-100).",
    user: `Website: ${websiteUrl}\nDescription: ${description}`,
  });
  if (result.ok) return result.data;

  // High-fidelity fallback logic (Demo Mode)
  const isMfg =
    description.toLowerCase().includes("mfg") ||
    description.toLowerCase().includes("manufacturing") ||
    description.toLowerCase().includes("auto");
  const isDtc =
    description.toLowerCase().includes("dtc") ||
    description.toLowerCase().includes("shopify") ||
    description.toLowerCase().includes("ecommerce");

  if (isMfg) {
    return {
      targetIndustries: ["Automotive Components", "Industrial Manufacturing", "Precision Engineering"],
      targetCountries: ["India", "Southeast Asia", "Germany"],
      headcountRanges: ["200-1000", "1000-5000"],
      targetJobTitles: ["Chief Human Resources Officer", "VP Operations", "Head of L&D", "Plant Director"],
      seniorityLevels: ["C-Suite", "VP", "Director"],
      inferredOffering: "Enterprise Transformation & Operational Workforce Upskilling",
      keyPainPoints: [
        "Rapid capacity expansion requiring plant supervisor upskilling",
        "High churn in operational leadership",
        "Lack of standardized multi-site SOPs",
      ],
      suggestedExclusions: ["Unregistered subcontractors", "B2C retail stores"],
      minQualificationScore: 85,
    };
  }

  if (isDtc) {
    return {
      targetIndustries: ["DTC Apparel", "Beauty & Personal Care", "Consumer Electronics"],
      targetCountries: ["United States", "United Kingdom", "Canada"],
      headcountRanges: ["20-100", "100-500"],
      targetJobTitles: ["VP Growth", "Head of Performance Marketing", "Chief Marketing Officer"],
      seniorityLevels: ["VP", "Head", "Director"],
      inferredOffering: "High-LTV Retention & AI Creative Optimization for Shopify Brands",
      keyPainPoints: [
        "Rising Meta/Google CAC hurting contribution margins",
        "Low repeat purchase rate within 60 days",
      ],
      suggestedExclusions: ["Amazon-only sellers", "Dropshipping stores"],
      minQualificationScore: 80,
    };
  }

  return {
    targetIndustries: ["B2B SaaS", "Cloud Infrastructure", "Cybersecurity", "Fintech"],
    targetCountries: ["United States", "United Kingdom", "India"],
    headcountRanges: ["50-250", "250-1000"],
    targetJobTitles: ["VP Sales", "Chief Revenue Officer", "Head of Growth", "Director of Business Development"],
    seniorityLevels: ["VP", "C-Suite", "Director"],
    inferredOffering: "Predictive B2B Pipeline Generation & Buying-Signal Prospecting",
    keyPainPoints: [
      "Inbound pipeline slowing after Series A/B",
      "Sales development reps burning hours on manual account research",
      "Low cold outreach reply rates due to generic copy",
    ],
    suggestedExclusions: ["Pre-seed stealth startups", "Government agencies", "Competitors (Apollo, ZoomInfo)"],
    minQualificationScore: 85,
  };
}

export async function generateOutreachOpener(
  companyName: string,
  contactName: string,
  contactTitle: string,
  signalSummary: string
): Promise<string> {
  return `Hi ${contactName}, saw ${companyName}'s recent milestone: ${signalSummary}. Given your mandate leading ${contactTitle}, wanted to share how similar leaders capitalized on this exact window without adding manual overhead.`;
}
