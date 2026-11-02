import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/security/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const {
      phoneNumber,
      requestedCredits = 100,
      reason = "Scaling active pipeline searches",
      userEmail,
      userName,
      workspaceName,
    } = body;

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      return apiError("A valid contact phone number is required.", 400, "INVALID_PHONE");
    }

    const email = session?.email || userEmail || "user@enterprise.com";
    const name = userName || session?.fullName || email.split("@")[0];
    const wsId = session?.workspaceId || "global";
    const wsName = workspaceName || "Active Workspace";

    const supabase = createServerClient();

    // Log the credit request to audit_logs / usage_events so admin can inspect and grant
    await supabase.from("audit_logs").insert({
      workspace_id: wsId,
      actor_id: session?.userId || "guest-user",
      actor_email: email,
      action: "CREDIT_TOPUP_REQUEST",
      resource_type: "credits",
      resource_id: `req-${Date.now()}`,
      metadata: {
        phoneNumber: phoneNumber.trim(),
        requestedCredits: Number(requestedCredits),
        userName: name,
        workspaceName: wsName,
        reason,
        status: "pending",
        requested_at: new Date().toISOString(),
      },
    });

    return apiSuccess({
      message: "Credit request submitted successfully. Super Admin will contact you at your phone number.",
      status: "pending",
      phoneNumber,
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
    const supabase = createServerClient();
    const { data: requests, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", "CREDIT_TOPUP_REQUEST")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    const formatted = (requests || []).map((r) => ({
      id: r.id,
      email: r.actor_email,
      phoneNumber: r.metadata?.phoneNumber || "N/A",
      userName: r.metadata?.userName || r.actor_email.split("@")[0],
      workspaceName: r.metadata?.workspaceName || "Enterprise Workspace",
      requestedCredits: r.metadata?.requestedCredits || 100,
      reason: r.metadata?.reason || "Pipeline expansion",
      status: r.metadata?.status || "pending",
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
