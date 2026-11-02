import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { getSessionFromRequest, verifyWorkspaceAccess, DEMO_WORKSPACE_ID } from "@/lib/security/auth";
import { isValidUUID, sanitizeHtml } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 80, windowMs: 60 * 1000, prefix: "approvals_get" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    // Strict multi-tenant resolution: members can ONLY query their own workspace
    const workspaceId = session
      ? (session.role === "admin" ? (searchParams.get("workspaceId") || session.workspaceId) : session.workspaceId)
      : (searchParams.get("workspaceId") || DEMO_WORKSPACE_ID);

    const access = verifyWorkspaceAccess(session, workspaceId);
    if (!access.isAuthorized && access.errorResponse) {
      return access.errorResponse;
    }

    const status = searchParams.get("status") || "";
    const supabase = createServerClient();

    let query = supabase
      .from("approvals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: approvals, error } = await query;

    if (error) {
      return apiError(error.message, 500, "DB_ERROR");
    }

    return apiSuccess({ approvals: approvals || [] });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to fetch approvals",
      500,
      "APPROVALS_FETCH_ERROR"
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "approvals_patch" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const { id, status, notes = "" } = body;

    if (!id || !isValidUUID(id) || !["approved", "rejected"].includes(status)) {
      return apiError("Invalid approval payload or ID", 400, "INVALID_PAYLOAD");
    }

    const cleanNotes = sanitizeHtml(String(notes).slice(0, 500));
    const supabase = createServerClient();

    // Check existing approval item and verify tenant authorization
    const { data: existing } = await supabase
      .from("approvals")
      .select("id, workspace_id, item_type, item_id, title")
      .eq("id", id)
      .single();

    if (!existing) {
      return apiError("Approval record not found", 404, "NOT_FOUND");
    }

    if (session) {
      const access = verifyWorkspaceAccess(session, existing.workspace_id);
      if (!access.isAuthorized && access.errorResponse) {
        return access.errorResponse;
      }
    }

    const { data: updated, error } = await supabase
      .from("approvals")
      .update({
        status,
        notes: cleanNotes,
        actioned_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return apiError(error?.message || "Failed to update approval", 500, "DB_UPDATE_ERROR");
    }

    // Record audit log
    await supabase.from("audit_logs").insert({
      workspace_id: updated.workspace_id,
      actor_email: session?.email || "reviewer@revgeniq.os",
      action: `approval_${status}`,
      target_type: updated.item_type,
      target_id: updated.item_id || id,
      details: { title: updated.title, notes: cleanNotes },
    });

    return apiSuccess({ approval: updated });
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to update approval",
      500,
      "APPROVAL_UPDATE_ERROR"
    );
  }
}
