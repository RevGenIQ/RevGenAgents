import { NextRequest } from "next/server";
import * as z from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest, UUID_PATTERN } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { apiError, apiSuccess } from "@/lib/api/response";
import { applyPayload, isStaffOnRequest, loadRequest, postChannelNotice, type EnrichmentStatus } from "@/lib/enrichment/service";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), humagentId: z.string().regex(UUID_PATTERN) }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("send_back"), note: z.string().trim().min(3).max(1000) }),
]);

/**
 * Moves an enrichment request through its workflow:
 * Admin assigns -> Humagent starts (and uploads the CSV via /csv) ->
 * Admin approves (applies the staged data and delivers) or sends it back.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;
    const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "enrichment_patch" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return apiError("Invalid request id.", 400, "INVALID_ID");
    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("Unknown action.", 400, "INVALID_ACTION");

    const supabase = createServerClient();
    const req = await loadRequest(supabase, id);
    if (!req || !isStaffOnRequest(session, req)) return apiError("Request not found.", 404, "NOT_FOUND");
    const body = parsed.data;
    const now = new Date().toISOString();
    const update = async (patch: Record<string, unknown>, from: EnrichmentStatus[]) => {
      const { data, error } = await supabase
        .from("enrichment_requests")
        .update({ ...patch, updated_at: now })
        .eq("id", id)
        .in("status", from)
        .select("id, status")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    };

    if (body.action === "assign") {
      if (session.role !== "admin") return apiError("Only the Admin assigns enrichment.", 403, "FORBIDDEN");
      const { data: hum } = await supabase.from("humagent_users").select("id, full_name, status").eq("id", body.humagentId).maybeSingle();
      if (!hum || hum.status !== "active") return apiError("That Humagent is not active.", 400, "INVALID_HUMAGENT");
      const done = await update({ status: "assigned", assigned_humagent_id: hum.id, assigned_humagent_name: hum.full_name }, ["requested", "assigned", "in_progress"]);
      if (!done) return apiError("This request can no longer be reassigned.", 409, "INVALID_STATE");
      await postChannelNotice(supabase, req.workspace_id, `${hum.full_name} (Humagent) is enriching your sample accounts.`, { event: "enrichment_assigned", requestId: id });
      return apiSuccess({ request: done });
    }

    if (body.action === "start") {
      if (session.role !== "humagent" || req.assigned_humagent_id !== session.userId) return apiError("Only the assigned Humagent can start this.", 403, "FORBIDDEN");
      const done = await update({ status: "in_progress" }, ["assigned"]);
      return done ? apiSuccess({ request: done }) : apiError("This request is not waiting to start.", 409, "INVALID_STATE");
    }

    if (session.role !== "admin") return apiError("Only the Admin reviews enrichment.", 403, "FORBIDDEN");

    if (body.action === "send_back") {
      const done = await update({ status: "in_progress", admin_note: body.note }, ["submitted"]);
      return done ? apiSuccess({ request: done }) : apiError("Only submitted enrichment can be sent back.", 409, "INVALID_STATE");
    }

    // approve: claim the request first so a double click cannot apply the payload twice.
    if (req.status !== "submitted" || !req.payload) return apiError("Only submitted enrichment can be approved.", 409, "INVALID_STATE");
    const claimed = await update({ status: "approved", approved_at: now }, ["submitted"]);
    if (!claimed) return apiError("This request was already reviewed.", 409, "INVALID_STATE");
    try {
      const result = await applyPayload(supabase, req, req.payload);
      await update({ status: "delivered", delivered_at: new Date().toISOString() }, ["approved"]);
      await postChannelNotice(
        supabase,
        req.workspace_id,
        `Your enriched accounts are ready: ${result.companies} account${result.companies === 1 ? "" : "s"}${result.added ? ` (${result.added} added)` : ""} and ${result.contacts} contact${result.contacts === 1 ? "" : "s"}. Download the PDF from your Sample accounts page.`,
        { event: "enrichment_delivered", requestId: id }
      );
      return apiSuccess({ delivered: true, ...result });
    } catch (applyErr) {
      // Leave it reviewable: nothing is marked delivered unless every write succeeded.
      await update({ status: "submitted", admin_note: `Apply failed: ${applyErr instanceof Error ? applyErr.message : "unknown error"}`.slice(0, 1000) }, ["approved"]);
      console.error("Enrichment apply failed", applyErr);
      return apiError("Applying the enrichment failed. Nothing was delivered; please try again.", 500, "APPLY_FAILED");
    }
  } catch (err) {
    console.error("Enrichment action failed", err);
    return apiError("Could not update the request.", 500, "ENRICHMENT_ERROR");
  }
}
