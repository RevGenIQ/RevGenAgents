import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export interface UserSession {
  userId: string;
  email: string;
  role: "admin" | "client" | "humagent" | "member";
  workspaceId: string;
  companyDomain: string;
  fullName?: string;
  companyName?: string;
  loginId?: string;
  exp: number;
}

const MIN_SECRET_LENGTH = 32;

/**
 * Reads a signing secret from the environment. There is deliberately no fallback:
 * a missing or short secret must fail closed instead of signing with a value
 * that anyone reading the source could reproduce.
 */
function getSigningSecret(name: "JWT_SECRET" | "ADMIN_SECRET_KEY"): string {
  const value = (process.env[name] || "").trim();
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be set to at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return value;
}

function secretForRole(role: UserSession["role"]): string {
  return role === "admin" ? getSigningSecret("ADMIN_SECRET_KEY") : getSigningSecret("JWT_SECRET");
}

export const COOKIE_SESSION_NAME = "revgeniq_session";

/**
 * Creates a signed, tamper-proof session token with HMAC-SHA256 signature
 */
export function createSessionToken(payload: Omit<UserSession, "exp">, expiresInSeconds = 7 * 24 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: UserSession = { ...payload, exp };
  
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  
  const secret = secretForRole(payload.role);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a session token. Returns null if expired or invalid.
 */
export function verifySessionToken(token: string): UserSession | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: UserSession = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    const secret = secretForRole(payload.role);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies session from NextRequest (via HTTP-only Cookie or Authorization Header).
 */
export function getSessionFromRequest(request: NextRequest): UserSession | null {
  // 1. Try secure HTTP-only cookie
  const cookieToken = request.cookies.get(COOKIE_SESSION_NAME)?.value;
  if (cookieToken) {
    const session = verifySessionToken(cookieToken);
    if (session) return session;
  }

  // 2. Try Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    const session = verifySessionToken(bearerToken);
    if (session) return session;
  }

  return null;
}

/**
 * Timing-safe string comparison to protect admin authentication against timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Generates a deterministic, isolated tenant workspace UUID from a company domain.
 * Ensures domain 'acme.com' always maps to the same UUID v5-style string
 * and NEVER collides with or leaks into DEMO_WORKSPACE_ID.
 */
export function generateTenantWorkspaceId(domain: string): string {
  const clean = domain.toLowerCase().trim();
  const hash = crypto.createHash("sha256").update(`revgen_tenant_${clean}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Validates whether the caller is authorized to access a given workspace.
 * Fixes BOLA (Broken Object Level Authorization / IDOR):
 * - Super-admins can access any workspace.
 * - Regular members can ONLY access their own workspace.
 * - Unauthenticated users can ONLY access DEMO_WORKSPACE_ID for landing preview.
 */
export const DEMO_WORKSPACE_ID = "298c3a99-c53a-4493-acd5-1eb2964b2e6c";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyWorkspaceAccess(
  session: UserSession | null,
  requestedWorkspaceId: string
): { isAuthorized: boolean; errorResponse?: NextResponse } {
  // 1. Unauthenticated callers never get tenant data (the demo workspace is not seeded,
  //    and the public landing page only uses /api/public-intent).
  if (!session) {
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to access workspace data." },
        { status: 401 }
      ),
    };
  }

  // 2. Super-admin has cross-tenant administrative oversight, but must name a real
  //    workspace: admin sessions carry a placeholder ID that is not a UUID.
  if (session.role === "admin") {
    if (!UUID_PATTERN.test(requestedWorkspaceId || "")) {
      return {
        isAuthorized: false,
        errorResponse: NextResponse.json(
          { error: "Bad Request", message: "Admin requests must specify a valid workspaceId." },
          { status: 400 }
        ),
      };
    }
    return { isAuthorized: true };
  }

  // 3. Authenticated tenant members: strictly locked to their own workspace
  if (!requestedWorkspaceId || session.workspaceId !== requestedWorkspaceId) {
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        {
          error: "Forbidden",
          message: "Access denied. You do not have permission to access resources outside your tenant workspace.",
        },
        { status: 403 }
      ),
    };
  }

  return { isAuthorized: true };
}
