import { NextRequest } from "next/server";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import {
  createSessionToken,
  timingSafeCompare,
  COOKIE_SESSION_NAME,
} from "@/lib/security/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyPassword } from "@/lib/security/credentials";

export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) {
      return csrf.errorResponse;
    }

    const rl = rateLimit(request, { max: 10, windowMs: 15 * 60 * 1000, prefix: "auth_login" });
    if (!rl.allowed && rl.response) {
      return rl.response;
    }

    const body = await request.json().catch(() => ({}));
    const { identifier = "", email = "", password = "" } = body;

    const rawId = String(identifier || email).trim();
    const trimmedIdLower = rawId.toLowerCase();
    const trimmedPassword = String(password).trim();

    if (!rawId || !trimmedPassword) {
      return apiError("Login ID / Email and Password are required.", 400, "MISSING_CREDENTIALS");
    }

    // 1. Admin login: only from ADMIN_EMAIL & ADMIN_PASSWORD. Disabled when either is unset.
    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = (process.env.ADMIN_PASSWORD || "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (
      adminEmail &&
      adminPassword &&
      trimmedIdLower === adminEmail &&
      timingSafeCompare(trimmedPassword, adminPassword)
    ) {
      const token = createSessionToken({
        userId: "admin-master-uid-0001",
        email: adminEmail,
        role: "admin",
        workspaceId: "admin-master-workspace",
        companyDomain: "revgenai.os",
        fullName: "RevGen AI Super Admin",
        companyName: "RevGen AI",
      });

      const response = apiSuccess({
        message: "Admin authenticated successfully.",
        user: {
          userId: "admin-master-uid-0001",
          email: adminEmail,
          role: "admin",
          workspaceId: "admin-master-workspace",
          companyDomain: "revgenai.os",
          fullName: "RevGen AI Super Admin",
          companyName: "RevGen AI",
        },
        redirectUrl: "/admin",
      });

      response.cookies.set({
        name: COOKIE_SESSION_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 3600,
      });

      return response;
    }

    const supabase = createServerClient();

    // 2. Check for Human Agent (Humagent) Login (Created strictly by Admin in public.humagent_users)
    const { data: humagents } = await supabase
      .from("humagent_users")
      .select("*")
      .eq("status", "active");

    const matchedHumagent = (humagents || []).find(
      (h: any) =>
        (String(h.login_id || "").toLowerCase() === trimmedIdLower ||
          String(h.email || "").toLowerCase() === trimmedIdLower) &&
        timingSafeCompare(String(h.password_plain || ""), trimmedPassword)
    );

    if (matchedHumagent) {
      const token = createSessionToken({
        userId: matchedHumagent.id,
        email: matchedHumagent.email,
        role: "humagent",
        workspaceId: "humagent-workspace",
        companyDomain: "revgenai.os",
        fullName: matchedHumagent.full_name,
        companyName: "RevGen AI QA",
        loginId: matchedHumagent.login_id,
      });

      const response = apiSuccess({
        message: "Human Agent (Humagent) authenticated successfully.",
        user: {
          userId: matchedHumagent.id,
          email: matchedHumagent.email,
          role: "humagent",
          workspaceId: "humagent-workspace",
          companyDomain: "revgenai.os",
          fullName: matchedHumagent.full_name,
          companyName: "RevGen AI QA",
          loginId: matchedHumagent.login_id,
        },
        redirectUrl: "/human-agent",
      });

      response.cookies.set({
        name: COOKIE_SESSION_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 3600,
      });

      return response;
    }

    // 3. Check for Admin-Approved Client Login (Strictly from public.workspaces)
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("*")
      .eq("approval_status", "approved");

    const matchedWorkspace = (workspaces || []).find((ws: any) => {
      const genIdMatch =
        String(ws.generated_login_id || "").toLowerCase() === trimmedIdLower;
      const primaryEmailMatch =
        String(ws.primary_email || "").toLowerCase() === trimmedIdLower;
      const spokespersonsList = Array.isArray(ws.spokespersons)
        ? ws.spokespersons
        : [];
      // Only emails already registered on the workspace may log in; a matching
      // email domain alone is not enough.
      const spokespersonEmailMatch = spokespersonsList.some(
        (sp: any) => String(sp.email || "").toLowerCase() === trimmedIdLower
      );

      // Self-registered clients have a scrypt hash; admin-created ones a generated password.
      const passwordMatches = ws.password_hash
        ? verifyPassword(trimmedPassword, ws.password_hash)
        : timingSafeCompare(String(ws.generated_password || ""), trimmedPassword);

      return (
        passwordMatches &&
        (genIdMatch || primaryEmailMatch || spokespersonEmailMatch)
      );
    });

    if (matchedWorkspace && matchedWorkspace.plan === "suspended") {
      return apiError("This workspace is suspended. Please contact RevGen IQ support.", 403, "ACCOUNT_SUSPENDED");
    }

    if (matchedWorkspace) {
      let spokespersonName = matchedWorkspace.name + " Spokesperson";
      let spokespersonEmail = matchedWorkspace.primary_email || `${matchedWorkspace.slug}@${matchedWorkspace.domain}`;

      const spokespersonsList = Array.isArray(matchedWorkspace.spokespersons)
        ? matchedWorkspace.spokespersons
        : [];

      const existingSp = trimmedIdLower.includes("@")
        ? spokespersonsList.find(
            (sp: any) => String(sp.email || "").toLowerCase() === trimmedIdLower
          )
        : undefined;

      if (trimmedIdLower.includes("@")) {
        spokespersonEmail = trimmedIdLower;
        spokespersonName = existingSp?.fullName || existingSp?.name || spokespersonName;
      } else if (spokespersonsList[0]) {
        spokespersonName = spokespersonsList[0].fullName || spokespersonName;
        spokespersonEmail = spokespersonsList[0].email || spokespersonEmail;
      }

      const token = createSessionToken({
        userId: `client-${matchedWorkspace.id}`,
        email: spokespersonEmail,
        role: "client",
        workspaceId: matchedWorkspace.id,
        companyDomain: matchedWorkspace.domain,
        fullName: spokespersonName,
        companyName: matchedWorkspace.name,
        loginId: matchedWorkspace.generated_login_id,
      });

      const response = apiSuccess({
        message: "Client authenticated successfully.",
        user: {
          userId: `client-${matchedWorkspace.id}`,
          email: spokespersonEmail,
          role: "client",
          workspaceId: matchedWorkspace.id,
          companyDomain: matchedWorkspace.domain,
          fullName: spokespersonName,
          companyName: matchedWorkspace.name,
          loginId: matchedWorkspace.generated_login_id,
        },
        redirectUrl: "/",
      });

      response.cookies.set({
        name: COOKIE_SESSION_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 3600,
      });

      return response;
    }

    // 4. Check if this email has a pending Client Access Request
    const { data: pendingReq } = await supabase
      .from("client_access_requests")
      .select("status, company_name")
      .eq("work_email", trimmedIdLower)
      .maybeSingle();

    if (pendingReq && pendingReq.status === "pending") {
      return apiError(
        `Your access request for "${pendingReq.company_name}" is currently pending Admin approval. Once the Admin approves your request, your generated Login ID & Password will be shared to your email.`,
        403,
        "PENDING_ADMIN_APPROVAL"
      );
    }

    return apiError(
      "Email or password is incorrect. New to RevGen IQ? Create your workspace to claim 5 free sample accounts.",
      401,
      "INVALID_CREDENTIALS"
    );
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Authentication failed",
      500,
      "AUTH_ERROR"
    );
  }
}
