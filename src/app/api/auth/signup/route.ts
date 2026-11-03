import { NextRequest } from "next/server";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { validateCompanyEmail, validateCompanyDomain, sanitizeHtml } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { createSessionToken } from "@/lib/security/auth";
import { generateIdSuffix, hashPassword, passwordProblem } from "@/lib/security/credentials";
import { withSessionCookie } from "@/lib/security/sessionCookie";

/**
 * Self-serve client registration: a business email creates the workspace on the
 * trial plan (one free sample run) and signs the client in immediately.
 * One workspace per company domain, so the free sample cannot be claimed twice
 * by colleagues of the same company.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 5, windowMs: 60 * 60 * 1000, prefix: "auth_signup" });
    if (!rl.allowed && rl.response) return rl.response;

    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = sanitizeHtml(String(body.fullName || "").trim()).slice(0, 120);
    const companyName = sanitizeHtml(String(body.companyName || "").trim()).slice(0, 160);
    const jobTitle = sanitizeHtml(String(body.jobTitle || "").trim()).slice(0, 120);
    const phone = sanitizeHtml(String(body.phone || "").trim()).slice(0, 40);

    if (!email || !fullName || !password) {
      return apiError("Full name, work email and password are required.", 400, "MISSING_FIELDS");
    }

    const emailCheck = validateCompanyEmail(email);
    if (!emailCheck.isValid) {
      return apiError(emailCheck.error || "Please register with your company work email.", 400, "INVALID_COMPANY_EMAIL");
    }
    const domainCheck = validateCompanyDomain(String(body.companyDomain || "").trim() || emailCheck.domain || "");
    if (!domainCheck.isValid || !domainCheck.cleanedDomain) {
      return apiError(domainCheck.error || "A valid company domain is required.", 400, "INVALID_COMPANY_DOMAIN");
    }
    const weak = passwordProblem(password);
    if (weak) return apiError(weak, 400, "WEAK_PASSWORD");

    const domain = domainCheck.cleanedDomain;
    const name = companyName || domain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
    const supabase = createServerClient();

    const [byEmail, byDomain] = await Promise.all([
      supabase.from("workspaces").select("id").eq("primary_email", email).limit(1),
      supabase.from("workspaces").select("id").eq("domain", domain).limit(1),
    ]);
    if (byEmail.error || byDomain.error) return apiError("Could not check existing accounts.", 500, "DB_ERROR");
    const sameEmail = (byEmail.data || []).length > 0;
    if (sameEmail || (byDomain.data || []).length > 0) {
      return apiError(
        sameEmail
          ? "An account with this email already exists. Please sign in."
          : `${domain} already has a RevGen IQ workspace. Ask its owner to add you, or contact us.`,
        409,
        sameEmail ? "ACCOUNT_EXISTS" : "COMPANY_EXISTS"
      );
    }

    const suffix = generateIdSuffix();
    const prefix = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
    const channelName = `RevGenIQx${name.replace(/[^a-zA-Z0-9]/g, "")}`;

    const { data: workspace, error: insertErr } = await supabase
      .from("workspaces")
      .insert({
        name,
        slug: `${domain.replace(/[^a-z0-9]/g, "-")}-${suffix}`,
        domain,
        primary_email: email,
        generated_login_id: `${prefix}-CLIENT-${suffix}`,
        password_hash: hashPassword(password),
        approval_status: "approved",
        registered_via: "self",
        plan: "trial",
        sample_status: "not_claimed",
        channel_name: channelName,
        talky_room_id: channelName,
        talky_room_url: "",
        spokespersons: [
          { id: `sp-${Date.now()}`, fullName, email, title: jobTitle || "Founder / Team lead", phone, joinedAt: new Date().toISOString() },
        ],
      })
      .select("id, name, domain, generated_login_id")
      .single();
    if (insertErr || !workspace) {
      return apiError("Could not create your workspace. Please try again.", 500, "DB_INSERT_ERROR");
    }

    const { error: msgErr } = await supabase.from("workspace_messages").insert({
      workspace_id: workspace.id,
      sender_role: "system",
      sender_name: "RevGen IQ",
      message_type: "system",
      content: `Welcome, ${fullName}. Your workspace for ${name} is ready. Claim your 5 free sample accounts from the dashboard; our team is here in this channel if you need anything.`,
      metadata: { event: "client_registered" },
    });
    if (msgErr) console.error("Welcome message failed", msgErr.message);

    const user = {
      userId: `client-${workspace.id}`,
      email,
      role: "client" as const,
      workspaceId: workspace.id,
      companyDomain: workspace.domain,
      fullName,
      companyName: workspace.name,
      loginId: workspace.generated_login_id,
    };
    const response = apiSuccess({ message: "Workspace created.", user, redirectUrl: "/" }, 201);
    return withSessionCookie(response, createSessionToken(user));
  } catch (err: unknown) {
    console.error("Registration failed", err);
    return apiError("Registration failed. Please try again.", 500, "REGISTRATION_ERROR");
  }
}
