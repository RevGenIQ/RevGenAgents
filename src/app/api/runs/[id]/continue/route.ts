import { after, NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { continueProspectingRun, isLangGraphEngine } from "@/lib/agents";
import { CONTINUE_SECRET_HEADER, driveRun, getContinueSecret } from "@/lib/agents/continuation";
import { timingSafeCompare } from "@/lib/security/auth";
import { verifyCsrfAndOrigin } from "@/lib/security/cors";
import { rateLimit } from "@/lib/security/rateLimit";
import { isValidUUID } from "@/lib/security/validator";
import { apiError, apiSuccess } from "@/lib/api/response";

// Each continuation is a fresh invocation with its own time budget.
export const maxDuration = 300;

/**
 * Internal: resumes an unfinished LangGraph thread from its last checkpoint.
 * Called server-to-server by driveRun() when an invocation hits its time budget.
 * Authenticated by the shared AGENT_CONTINUE_SECRET header; fails closed when unset.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = verifyCsrfAndOrigin(request);
    if (!csrf.isAllowed && csrf.errorResponse) return csrf.errorResponse;

    const rl = rateLimit(request, { max: 30, windowMs: 60 * 1000, prefix: "run_continue" });
    if (!rl.allowed && rl.response) return rl.response;

    const secret = getContinueSecret();
    if (!secret) {
      return apiError("Run continuation is not configured.", 503, "CONTINUE_NOT_CONFIGURED");
    }
    const provided = request.headers.get(CONTINUE_SECRET_HEADER) || "";
    if (!timingSafeCompare(provided, secret)) {
      return apiError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!isLangGraphEngine()) {
      return apiError("The LangGraph engine is not enabled.", 409, "ENGINE_DISABLED");
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return apiError("Invalid run identifier", 400, "INVALID_RUN_ID");
    }

    const supabase = createServerClient();
    const { data: run, error } = await supabase
      .from("research_runs")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return apiError(error.message, 500, "DB_ERROR");
    if (!run) return apiError("Run not found", 404, "RUN_NOT_FOUND");

    // A stopped run is still continued so its graph can reach finalize.
    if (run.status === "completed" || run.status === "failed") {
      return apiError(`Run is already ${run.status}.`, 409, "RUN_FINISHED");
    }

    after(async () => {
      try {
        await driveRun(id, () => continueProspectingRun(id));
      } catch (e) {
        console.error("Run continuation error:", e);
      }
    });

    return apiSuccess({ accepted: true, runId: id }, 202);
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Failed to continue run",
      500,
      "RUN_CONTINUE_ERROR"
    );
  }
}
