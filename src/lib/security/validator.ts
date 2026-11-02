/**
 * Security & Input Validation Library
 * - SQL / PostgREST Injection Protection
 * - Business / Company Email & Domain Validation
 * - XSS & CSV Injection Sanitization
 * - UUID & Parameter Integrity Checks
 */

// Common consumer, free, or temporary email domains that are prohibited for B2B sign-in/up
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "mail.com",
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "throwawaymail.com",
]);

/**
 * Validates whether an email is a legitimate company / work email.
 */
export function validateCompanyEmail(email: string): {
  isValid: boolean;
  domain?: string;
  error?: string;
} {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email address is required." };
  }

  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
  const match = clean.match(emailRegex);

  if (!match) {
    return { isValid: false, error: "Invalid email format." };
  }

  const domain = match[1];

  if (CONSUMER_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      domain,
      error: `Please sign up with your official company email (e.g. name@${domain.includes("gmail") ? "company.com" : "domain.com"}). Free webmail addresses (${domain}) are not permitted.`,
    };
  }

  return { isValid: true, domain };
}

/**
 * Validates a company canonical domain.
 */
export function validateCompanyDomain(domain: string): {
  isValid: boolean;
  cleanedDomain?: string;
  error?: string;
} {
  if (!domain || typeof domain !== "string") {
    return { isValid: false, error: "Company domain is required." };
  }

  let cleaned = domain.trim().toLowerCase();
  // Strip protocol and path
  cleaned = cleaned.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(cleaned)) {
    return { isValid: false, error: "Invalid domain format. Example: acmecorp.com" };
  }

  if (CONSUMER_EMAIL_DOMAINS.has(cleaned)) {
    return { isValid: false, error: "Domain cannot be a public consumer webmail provider." };
  }

  return { isValid: true, cleanedDomain: cleaned };
}

/**
 * Validates that an input is a valid RFC 4122 UUID.
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid.trim());
}

/**
 * Sanitizes search terms before passing to PostgREST filter queries
 * to prevent PostgREST grammar injection or SQL escaping errors.
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== "string") return "";
  // Strip characters that alter PostgREST filter logic: commas, parens, quotes, dots in operators
  return query
    .replace(/[(),]/g, " ")
    .replace(/['"\\%_]/g, "")
    .trim()
    .slice(0, 100);
}

/**
 * Escapes strings to prevent CSV / Formula Injection
 * (preventing execution of =cmd|'/c calc'!A0 if exported file is opened in Excel)
 */
export function sanitizeForCsv(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // If starts with dangerous spreadsheet formula triggers, prepend a single quote
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Sanitize basic HTML to protect against Cross-Site Scripting (XSS).
 */
export function sanitizeHtml(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates upload batch size to prevent DoS attacks.
 */
export function validateBatchRows(rows: unknown[], maxRows: number = 500): {
  isValid: boolean;
  error?: string;
} {
  if (!Array.isArray(rows)) {
    return { isValid: false, error: "Input payload must be an array of rows." };
  }
  if (rows.length === 0) {
    return { isValid: false, error: "Import file contains no data rows." };
  }
  if (rows.length > maxRows) {
    return {
      isValid: false,
      error: `Import batch exceeds maximum allowable limit of ${maxRows} records. Please split your file.`,
    };
  }
  return { isValid: true };
}
