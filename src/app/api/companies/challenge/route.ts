import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { getSessionFromRequest, verifyWorkspaceAccess } from "@/lib/security/auth";
import { sanitizeHtml } from "@/lib/security/validator";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "challenge_post" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    const companyName = sanitizeHtml(String(body.companyName || "").slice(0, 200));
    const reason = sanitizeHtml(String(body.reason || "Wrong fit").slice(0, 300));
    const notes = sanitizeHtml(String(body.notes || "").slice(0, 1000));

    if (!companyId && !companyName) {
      return apiError("Missing companyId or companyName", 400, "VALIDATION_ERROR");
    }

    const wsId = session?.role === "admin" ? String(body.workspaceId || "") : session?.workspaceId || "";

    const access = verifyWorkspaceAccess(session, wsId);
    if (!access.isAuthorized && access.errorResponse) return access.errorResponse;

    const supabase = createServerClient();

    const { error: auditErr } = await supabase.from("audit_logs").insert({
      workspace_id: wsId,
      actor_email: session?.email || null,
      action: "account_challenged",
      target_type: "company",
      target_id: companyId || null,
      details: { companyName, reason, notes },
    });

    if (auditErr) {
      return apiError(auditErr.message, 500, "AUDIT_INSERT_ERROR");
    }

    // Reject pending approvals for this company, scoped to the caller's workspace.
    if (companyId) {
      const { error: approvalErr } = await supabase
        .from("approvals")
        .update({ status: "rejected" })
        .eq("item_id", companyId)
        .eq("workspace_id", wsId);
      if (approvalErr) {
        return apiError(approvalErr.message, 500, "APPROVAL_UPDATE_ERROR");
      }
    }

    // No credit is issued automatically: the challenge is recorded for admin review.
    return apiSuccess({
      status: "recorded",
      message: `Challenge recorded for ${companyName || "this account"}. Our team will review it and adjust credits if it is upheld.`,
    });
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to process challenge", 500);
  }
}
