import { NextRequest } from "next/server";
import * as z from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionFromRequest } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { isSuspendedClient } from "@/lib/security/workspaceAccess";
import { apiError, apiSuccess } from "@/lib/api/response";
import { OPEN_STATUSES, postChannelNotice } from "@/lib/enrichment/service";

const LIST_COLUMNS =
  "id, workspace_id, run_id, status, client_note, requested_columns, assigned_humagent_id, assigned_humagent_name, admin_note, csv_rows, submitted_at, delivered_at, created_at, updated_at, payload";

/** Requests the caller may see: a client's own, a Humagent's assigned ones, or all for the Admin. */
export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, { max: 90, windowMs: 60 * 1000, prefix: "enrichment_get" });
    if (!rl.allowed && rl.response) return rl.response;
    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");

    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) return apiError("This workspace is suspended.", 403, "ACCOUNT_SUSPENDED");

    let query = supabase.from("enrichment_requests").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(100);
    if (session.role === "humagent") query = query.eq("assigned_humagent_id", session.userId);
    else if (session.role !== "admin") query = query.eq("workspace_id", session.workspaceId);
    const { data, error } = await query;
    if (error) return apiError("Could not load enrichment requests.", 500, "DB_ERROR");

    const ids = [...new Set((data || []).map((r) => r.workspace_id))];
    const { data: workspaces } = ids.length ? await supabase.from("workspaces").select("id, name, domain").in("id", ids) : { data: [] };
    const names = new Map((workspaces || []).map((w) => [w.id, { name: w.name, domain: w.domain }]));

    const requests = (data || []).map((r) => {
      const payload = r.payload as { companies?: unknown[]; contacts?: unknown[]; warnings?: string[] } | null;
      return {
        ...r,
        payload: undefined,
        workspaceName: names.get(r.workspace_id)?.name || "Client",
        workspaceDomain: names.get(r.workspace_id)?.domain || "",
        // Staff see what was staged; the client only sees counts after delivery.
        staged:
          payload && (session.role !== "client" || r.status === "delivered")
            ? { companies: payload.companies?.length || 0, contacts: payload.contacts?.length || 0, warnings: session.role === "client" ? [] : payload.warnings || [] }
            : null,
      };
    });
    return apiSuccess({ requests });
  } catch (err) {
    console.error("Enrichment list failed", err);
    return apiError("Could not load enrichment requests.", 500, "ENRICHMENT_ERROR");
  }
}

const createSchema = z.object({
  note: z.string().trim().max(1000).default(""),
  columns: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
});

/** A client asks the team to enrich their delivered sample. One open request per run. */
export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;
    const rl = rateLimit(request, { max: 10, windowMs: 60 * 1000, prefix: "enrichment_post" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");
    if (session.role !== "client") return apiError("Only clients request enrichment.", 403, "FORBIDDEN");
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("Invalid request.", 400, "INVALID_INPUT");

    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) return apiError("This workspace is suspended.", 403, "ACCOUNT_SUSPENDED");
    const { data: ws } = await supabase.from("workspaces").select("id, sample_status, sample_run_id").eq("id", session.workspaceId).maybeSingle();
    if (!ws?.sample_run_id || ws.sample_status !== "delivered") {
      return apiError("Enrichment is available once your sample has been delivered.", 409, "SAMPLE_NOT_DELIVERED");
    }

    const { data: open } = await supabase
      .from("enrichment_requests")
      .select("id")
      .eq("workspace_id", ws.id)
      .eq("run_id", ws.sample_run_id)
      .in("status", OPEN_STATUSES)
      .limit(1);
    if (open && open.length > 0) return apiError("An enrichment request for these accounts is already in progress.", 409, "ALREADY_REQUESTED");

    const { data: created, error } = await supabase
      .from("enrichment_requests")
      .insert({ workspace_id: ws.id, run_id: ws.sample_run_id, status: "requested", client_note: parsed.data.note || null, requested_columns: parsed.data.columns })
      .select("id, status, created_at")
      .single();
    if (error || !created) return apiError("Could not create the request.", 500, "DB_ERROR");

    await postChannelNotice(
      supabase,
      ws.id,
      `Enrichment requested for the sample accounts${parsed.data.note ? `: "${parsed.data.note.slice(0, 300)}"` : ""}. The Admin will assign a Humagent.`,
      { event: "enrichment_requested", requestId: created.id }
    );
    return apiSuccess({ request: created }, 201);
  } catch (err) {
    console.error("Enrichment request failed", err);
    return apiError("Could not create the request.", 500, "ENRICHMENT_ERROR");
  }
}
