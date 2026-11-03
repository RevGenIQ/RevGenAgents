import { after, NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isLangGraphEngine, startProspectingRun } from "@/lib/agents";
import { driveRun } from "@/lib/agents/continuation";
import { getSessionFromRequest } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { isSuspendedClient } from "@/lib/security/workspaceAccess";
import { apiError, apiSuccess } from "@/lib/api/response";
import { SAMPLE_MIN_FIT_SCORE, SAMPLE_TARGET_COUNT, sampleIcpSchema, toIcpBrief, toSampleRunInput } from "@/lib/samples/sampleIcp";

export const maxDuration = 300;

const CLAIMABLE = ["not_claimed", "icp_pending"];

/**
 * Starts the client's one free sample run: saves their ICP, then researches
 * 5 accounts live. The workspace's sample_status is switched to "running" with
 * a conditional update first, so two clicks (or two tabs) can never start two runs.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;
    const rl = rateLimit(request, { max: 5, windowMs: 60 * 1000, prefix: "samples_run" });
    if (!rl.allowed && rl.response) return rl.response;

    const session = getSessionFromRequest(request);
    if (!session) return apiError("Authentication required.", 401, "UNAUTHORIZED");
    if (session.role !== "client") return apiError("Only clients claim free samples.", 403, "FORBIDDEN");
    if (!isLangGraphEngine()) return apiError("Live research is not available right now. Please try again later.", 503, "ENGINE_DISABLED");

    const parsed = sampleIcpSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Please complete the ICP form.", 400, "INVALID_ICP");
    }
    const icp = parsed.data;

    const supabase = createServerClient();
    if (await isSuspendedClient(supabase, session)) return apiError("This workspace is suspended.", 403, "ACCOUNT_SUSPENDED");

    const { data: claimed, error: claimErr } = await supabase
      .from("workspaces")
      .update({ sample_status: "running", icp_brief: toIcpBrief(icp), updated_at: new Date().toISOString() })
      .eq("id", session.workspaceId)
      .in("sample_status", CLAIMABLE)
      .select("id, name")
      .maybeSingle();
    if (claimErr) return apiError("Could not start your sample.", 500, "DB_ERROR");
    if (!claimed) return apiError("Your free sample has already been used.", 409, "SAMPLE_USED");

    const { data: run, error: runErr } = await supabase
      .from("research_runs")
      .insert({
        workspace_id: claimed.id,
        name: `Free sample: ${icp.industries.slice(0, 2).join(", ")} in ${icp.geographies.slice(0, 2).join(", ")}`.slice(0, 200),
        status: "queued",
        target_count: SAMPLE_TARGET_COUNT,
        min_icp_score: SAMPLE_MIN_FIT_SCORE,
        include_dm: true,
        maximize_coverage: true,
        live_search: true,
        icp_input: toSampleRunInput(icp),
        progress_percent: 0,
        current_step: "Starting research...",
        leads_found: 0,
        leads_verified: 0,
        stop_requested: false,
      })
      .select("id")
      .single();
    if (runErr || !run) {
      // Give the sample back: nothing was researched.
      await supabase.from("workspaces").update({ sample_status: "icp_pending" }).eq("id", claimed.id);
      return apiError("Could not start your sample. Please try again.", 500, "DB_INSERT_ERROR");
    }

    const { error: linkErr } = await supabase.from("workspaces").update({ sample_run_id: run.id }).eq("id", claimed.id);
    if (linkErr) console.error("Could not link sample run", linkErr.message);

    const { error: msgErr } = await supabase.from("workspace_messages").insert({
      workspace_id: claimed.id,
      sender_role: "system",
      sender_name: "RevGen IQ",
      message_type: "system",
      content: `Free sample started: researching ${SAMPLE_TARGET_COUNT} ${icp.industries.join(", ")} accounts in ${icp.geographies.join(", ")}.`,
      metadata: { event: "sample_started", runId: run.id },
    });
    if (msgErr) console.error("Sample start message failed", msgErr.message);

    after(async () => {
      try {
        await driveRun(run.id, () => startProspectingRun(run.id));
      } catch (e) {
        console.error("Sample run failed", e);
      }
    });

    return apiSuccess({ runId: run.id }, 202);
  } catch (err: unknown) {
    console.error("Sample start failed", err);
    return apiError("Could not start your sample.", 500, "SAMPLE_START_ERROR");
  }
}
