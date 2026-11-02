import { NextRequest } from "next/server";
import { parseIcpFromInput } from "@/lib/adapters/llm";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { validateSafeUrl } from "@/lib/security/ssrf";
import { sanitizeHtml } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Verification
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    // 2. Rate Limit: 20 parse requests per minute
    const rl = rateLimit(request, { max: 20, windowMs: 60 * 1000, prefix: "icp_parse" });
    if (!rl.allowed && rl.response) return rl.response;

    const body = await request.json().catch(() => ({}));
    const { websiteUrl = "", description = "" } = body;

    const trimmedUrl = String(websiteUrl).trim();
    const cleanDesc = sanitizeHtml(String(description).slice(0, 1000));

    if (!trimmedUrl && !cleanDesc) {
      return apiError(
        "Please provide either a company website or description.",
        400,
        "MISSING_INPUT"
      );
    }

    // SSRF Check if website URL is supplied
    if (trimmedUrl) {
      const formattedUrl = trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`;
      const ssrfCheck = validateSafeUrl(formattedUrl);
      if (!ssrfCheck.isSafe) {
        return apiError(
          ssrfCheck.error || "The provided URL is not accessible or restricted.",
          400,
          "SSRF_BLOCKED"
        );
      }
    }

    const parsed = await parseIcpFromInput(trimmedUrl, cleanDesc);
    return apiSuccess({ parsed });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to parse ICP",
      500,
      "ICP_PARSE_ERROR"
    );
  }
}
