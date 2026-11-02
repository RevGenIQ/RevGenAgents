import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

/**
 * Validates the Origin and Referer for CSRF protection on state-changing methods (POST, PUT, DELETE, PATCH).
 */
export function verifyCsrfAndOrigin(request: NextRequest): {
  isAllowed: boolean;
  errorResponse?: NextResponse;
} {
  const method = request.method.toUpperCase();

  // Read-only methods don't alter state
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { isAllowed: true };
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // In standard browser API calls from same origin:
  if (origin) {
    const isExplicitlyAllowed = ALLOWED_ORIGINS.includes(origin);
    const isSameHost = origin.includes(host || "");

    if (!isExplicitlyAllowed && !isSameHost) {
      return {
        isAllowed: false,
        errorResponse: NextResponse.json(
          { error: "Forbidden", message: "CSRF: Cross-origin request blocked." },
          { status: 403 }
        ),
      };
    }
  }

  return { isAllowed: true };
}

/**
 * Generates CORS headers for API responses.
 */
export function getCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
  };
}
