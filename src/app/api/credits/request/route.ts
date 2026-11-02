import { NextRequest } from "next/server";
import { getSessionFromRequest, verifyWorkspaceAccess } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { sanitizeHtml } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";

const CREDIT_REQUEST_ACTION = "CREDIT_TOPUP_REQUEST";

export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const rl = rateLimit(request, { max: 5, windowMs: 60 * 60 * 1000, prefix: "credit_request" });
    if (!rl.allowed && rl.response) return rl.response;

    // Credit requests belong to a real client workspace (audit_logs.workspace_id is a NOT NULL FK).
    const session = getSessionFromRequest(request);
    const wsId = session?.workspaceId || "";
    const access = verifyWorkspaceAccess(session, wsId);
    if (!access.isAuthorized && access.errorResponse) return access.errorResponse;

    const body = await request.json().catch(() => ({}));
    const phoneNumber = String(body.phoneNumber || "").trim();
    const requestedCredits = Number(body.requestedCredits ?? 100);
    const reason = sanitizeHtml(String(body.reason || "Scaling active pipeline searches").slice(0, 500));

    if (!/^[+\d][\d\s()-]{7,20}$/.test(phoneNumber)) {
      return apiError("A valid contact phone number is required.", 400, "INVALID_PHONE");
    }
    if (!Number.isInteger(requestedCredits) || requestedCredits < 1 || requestedCredits > 100000) {
      return apiError("Requested credits must be a whole number between 1 and 100,000.", 400, "INVALID_CREDITS");
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("audit_logs").insert({
      workspace_id: wsId,
      actor_email: session!.email,
      action: CREDIT_REQUEST_ACTION,
      target_type: "credits",
      details: {
        phoneNumber,
        requestedCredits,
        userName: session!.fullName || session!.email.split("@")[0],
        workspaceName: session!.companyName || "",
        reason,
        status: "pending",
      },
    });

    if (error) {
      return apiError(error.message, 500, "CREDIT_REQUEST_INSERT_ERROR");
    }

    return apiSuccess({
      message: "Credit request submitted successfully. Super Admin will contact you at your phone number.",
      status: "pending",
    });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to submit credit request",
      500,
      "CREDIT_REQUEST_ERROR"
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (session?.role !== "admin") {
      return apiError("Admin access required.", session ? 403 : 401, "FORBIDDEN");
    }

    const supabase = createServerClient();
    const { data: requests, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", CREDIT_REQUEST_ACTION)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    const formatted = (requests || []).map((r) => ({
      id: r.id,
      email: r.actor_email,
      phoneNumber: r.details?.phoneNumber || "N/A",
      userName: r.details?.userName || String(r.actor_email || "").split("@")[0],
      workspaceName: r.details?.workspaceName || "",
      requestedCredits: r.details?.requestedCredits || 0,
      reason: r.details?.reason || "",
      status: r.details?.status || "pending",
      createdAt: r.created_at,
    }));

    return apiSuccess({ requests: formatted });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to load requests",
      500,
      "CREDIT_REQUEST_LIST_ERROR"
    );
  }
}
