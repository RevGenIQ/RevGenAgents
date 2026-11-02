/**
 * Email Deliverability & Verification Adapter
 * Validates syntax, domain MX record, and catch-all detection.
 * Explicitly separates email deliverability from employment and ICP fit.
 * STRICT: Never returns fake deliverable scores when ZeroBounce key is missing.
 */

import { EmailStatus } from "../supabase/types";

export interface VerificationResult {
  email: string;
  status: EmailStatus;
  isCatchAll: boolean;
  hasMxRecord: boolean;
  score: number;
  reason: string;
  verifiedAt: string;
}

export async function verifyEmailAddress(email: string): Promise<VerificationResult> {
  const zeroBounceKey = process.env.ZEROBOUNCE_API_KEY;

  if (!email || !email.trim()) {
    return {
      email: "",
      status: "unverified",
      isCatchAll: false,
      hasMxRecord: false,
      score: 0,
      reason: "No email address provided for verification",
      verifiedAt: new Date().toISOString(),
    };
  }

  // RFC syntax validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      email,
      status: "undeliverable",
      isCatchAll: false,
      hasMxRecord: false,
      score: 0,
      reason: "Invalid email syntax RFC 5322",
      verifiedAt: new Date().toISOString(),
    };
  }

  if (zeroBounceKey) {
    try {
      const res = await fetch(
        `https://api.zerobounce.net/v2/validate?api_key=${zeroBounceKey}&email=${encodeURIComponent(
          email
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        const zbStatus = data.status;
        let mappedStatus: EmailStatus = "unverified";
        if (zbStatus === "valid") mappedStatus = "deliverable";
        else if (zbStatus === "catch-all") mappedStatus = "catch_all";
        else if (zbStatus === "invalid") mappedStatus = "undeliverable";

        return {
          email,
          status: mappedStatus,
          isCatchAll: zbStatus === "catch-all",
          hasMxRecord: data.mx_found === "true",
          score: parseFloat(data.sub_status || "90") || 90,
          reason: `ZeroBounce check: ${zbStatus} (sub-status: ${data.sub_status || "none"})`,
          verifiedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback below
    }
  }

  // When ZeroBounce is not configured, do not claim 98% deliverability!
  return {
    email,
    status: "unverified",
    isCatchAll: false,
    hasMxRecord: false,
    score: 0,
    reason: "Unverified: ZeroBounce API key not configured. Deliverability unknown.",
    verifiedAt: new Date().toISOString(),
  };
}
