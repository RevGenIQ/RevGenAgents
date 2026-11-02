import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory bucket store
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  windowMs?: number; // default 60,000ms (1 min)
  max?: number;      // default 60 requests per window
  prefix?: string;
}

/**
 * Extracts a client IP from NextRequest headers safely
 */
export function getClientIp(request: NextRequest): string {
  // Platform-set headers first: clients can prepend their own x-forwarded-for entries.
  const platformIp =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-nf-client-connection-ip");
  if (platformIp) return platformIp.split(",")[0].trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    return ips[0] || "127.0.0.1";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Check if a request exceeds rate limits.
 * Returns null if allowed, or a 429 Response if rate limit exceeded.
 */
export function rateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): { allowed: boolean; response?: NextResponse; remaining: number; reset: number } {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const prefix = options.prefix || "global";

  const ip = getClientIp(request);
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || record.resetAt < now) {
    record = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, record);
    return {
      allowed: true,
      remaining: max - 1,
      reset: record.resetAt,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, max - record.count);

  if (record.count > max) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    const response = NextResponse.json(
      {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(record.resetAt),
        },
      }
    );
    return {
      allowed: false,
      response,
      remaining: 0,
      reset: record.resetAt,
    };
  }

  return {
    allowed: true,
    remaining,
    reset: record.resetAt,
  };
}
