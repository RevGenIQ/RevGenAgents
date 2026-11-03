/**
 * Company profile: the firmographic columns the client and the Humagent CSV
 * need. Every value carries the URL it came from and how it was obtained, so
 * nothing in the profile is unattributed.
 */

export type FieldMethod = "website" | "registry" | "detected" | "ai_extracted" | "news" | "job_board";

export interface ProfileField {
  value: string;
  sourceUrl: string;
  method: FieldMethod;
}

export const PROFILE_FIELDS = [
  "website",
  "linkedinUrl",
  "facebookUrl",
  "twitterUrl",
  "phone",
  "email",
  "employeeCount",
  "industry",
  "techStack",
  "companyType",
  "keywords",
  "foundedYear",
  "sicCodes",
  "naicsCodes",
  "city",
  "state",
  "country",
  "hqLocation",
  "annualRevenue",
  "totalFunding",
  "latestFundingRound",
  "latestFundingAmount",
  "lastRaisedAt",
  "description",
] as const;

export type ProfileFieldName = (typeof PROFILE_FIELDS)[number];

export type CompanyProfile = Partial<Record<ProfileFieldName, ProfileField>>;

/** Fields a sample account should have; Data_Confidence is the share of these with a source. */
export const REQUIRED_PROFILE_FIELDS: ProfileFieldName[] = [
  "website",
  "linkedinUrl",
  "employeeCount",
  "industry",
  "hqLocation",
  "country",
  "foundedYear",
  "description",
  "techStack",
  "companyType",
];

/**
 * Merges profiles field by field: the first source that has a non-empty value
 * wins, so callers pass the most reliable source first.
 */
export function mergeProfiles(...profiles: CompanyProfile[]): CompanyProfile {
  return profiles.reduce<CompanyProfile>((acc, p) => {
    const additions = Object.fromEntries(
      Object.entries(p).filter(([k, f]) => f && f.value.trim() && !acc[k as ProfileFieldName])
    ) as CompanyProfile;
    return { ...acc, ...additions };
  }, {});
}

/** Percentage of required fields that have a sourced value. */
export function dataConfidence(profile: CompanyProfile): number {
  const filled = REQUIRED_PROFILE_FIELDS.filter((f) => profile[f]?.value.trim() && profile[f]?.sourceUrl).length;
  return Math.round((filled / REQUIRED_PROFILE_FIELDS.length) * 100);
}

export function missingRequired(profile: CompanyProfile): ProfileFieldName[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => !profile[f]?.value.trim());
}
