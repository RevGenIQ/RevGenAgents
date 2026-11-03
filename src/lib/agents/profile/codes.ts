/**
 * Official top-level industry classifications. The model may only choose from
 * these lists, so it can never invent a code; exact 4-digit SIC codes come
 * from registries (SEC EDGAR) when available.
 */

export const NAICS_SECTORS: Record<string, string> = {
  "11": "Agriculture, Forestry, Fishing and Hunting",
  "21": "Mining, Quarrying, and Oil and Gas Extraction",
  "22": "Utilities",
  "23": "Construction",
  "31-33": "Manufacturing",
  "42": "Wholesale Trade",
  "44-45": "Retail Trade",
  "48-49": "Transportation and Warehousing",
  "51": "Information",
  "52": "Finance and Insurance",
  "53": "Real Estate and Rental and Leasing",
  "54": "Professional, Scientific, and Technical Services",
  "55": "Management of Companies and Enterprises",
  "56": "Administrative and Support and Waste Management and Remediation Services",
  "61": "Educational Services",
  "62": "Health Care and Social Assistance",
  "71": "Arts, Entertainment, and Recreation",
  "72": "Accommodation and Food Services",
  "81": "Other Services (except Public Administration)",
  "92": "Public Administration",
};

export const SIC_DIVISIONS: Record<string, string> = {
  "A (01-09)": "Agriculture, Forestry, and Fishing",
  "B (10-14)": "Mining",
  "C (15-17)": "Construction",
  "D (20-39)": "Manufacturing",
  "E (40-49)": "Transportation, Communications, Electric, Gas, and Sanitary Services",
  "F (50-51)": "Wholesale Trade",
  "G (52-59)": "Retail Trade",
  "H (60-67)": "Finance, Insurance, and Real Estate",
  "I (70-89)": "Services",
  "J (91-99)": "Public Administration",
};

/** "54 Professional, Scientific, and Technical Services", or "" when the code is not on the list. */
export function naicsLabel(code: string): string {
  const c = code.trim();
  return NAICS_SECTORS[c] ? `NAICS ${c} ${NAICS_SECTORS[c]}` : "";
}

export function sicLabel(code: string): string {
  const c = code.trim();
  return SIC_DIVISIONS[c] ? `SIC Division ${c} ${SIC_DIVISIONS[c]}` : "";
}

/** The code lists as prompt text. */
export function codeListsForPrompt(): string {
  const naics = Object.entries(NAICS_SECTORS).map(([k, v]) => `${k}=${v}`).join("; ");
  const sic = Object.entries(SIC_DIVISIONS).map(([k, v]) => `${k}=${v}`).join("; ");
  return `NAICS sectors: ${naics}\nSIC divisions: ${sic}`;
}
