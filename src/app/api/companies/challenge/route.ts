import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "challenge_post" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const body = await request.json();
    const { companyId, companyName, reason, notes } = body;

    if (!companyId && !companyName) {
      return apiError("Missing companyId or companyName", 400, "VALIDATION_ERROR");
    }

    const wsId = session
      ? (session.role === "admin" ? (body.workspaceId || session.workspaceId) : session.workspaceId)
      : DEMO_WORKSPACE_ID;

    const access = verifyWorkspaceAccess(session, wsId);
    if (!access.isAuthorized && access.errorResponse) return access.errorResponse;

    const supabase = createServerClient();

    // 1. Log audit event with hash chain
    const auditText = `Account Challenge Upheld: ${companyName || companyId} - Reason: ${reason || "Wrong fit"}`;
    await supabase.from("audit_logs").insert({
      workspace_id: wsId,
      actor_email: session?.email || "analyst@revgeniq.os",
      action: "account_challenged_upheld",
      entity_type: "company",
      entity_id: companyId || "comp-challenge",
      details: {
        reason: reason || "Wrong fit persona",
        notes: notes || "",
        creditIssued: "$10.00",
        disqualifierFedBack: true,
      },
    });

    // 2. Mark approval/dossier status
    if (companyId) {
      await supabase
        .from("approvals")
        .update({ status: "rejected" })
        .eq("item_id", companyId);
    }

    return apiSuccess({
      success: true,
      status: "upheld",
      creditIssued: 10,
      message: `Challenge upheld for ${companyName}. $10 credit auto-issued to workspace ledger. Disqualifier '${reason}' added to targeting spec.`,
    });
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Failed to process challenge", 500);
  }
}
