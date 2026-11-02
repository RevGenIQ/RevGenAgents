/**
 * Secure Logging Utility
 * Automatically masks credentials, tokens, cookies, and sensitive fields from server logs.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "jwt",
  "service_role",
  "private_key",
  "credit_card",
  "access_token",
]);

function maskValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= 6) return "******";
    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }
  return "******";
}

export function sanitizeLogData(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some((pattern) =>
      lowerKey.includes(pattern)
    );

    if (isSensitive) {
      sanitized[key] = maskValue(val);
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export const logger = {
  info: (message: string, context?: unknown) => {
    if (context) {
      console.log(`[INFO] ${message}`, JSON.stringify(sanitizeLogData(context)));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn: (message: string, context?: unknown) => {
    if (context) {
      console.warn(`[WARN] ${message}`, JSON.stringify(sanitizeLogData(context)));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string, error?: unknown) => {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}: ${error.message}`);
    } else if (error) {
      console.error(`[ERROR] ${message}`, JSON.stringify(sanitizeLogData(error)));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },
};
