import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rateLimit";
import { isValidUUID } from "@/lib/security/validator";
import { getSessionFromRequest, verifyWorkspaceAccess } from "@/lib/security/auth";
import { RUN_ACCOUNT_COLUMNS, mapRunAccount } from "@/lib/accounts/runAccount";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = rateLimit(request, { max: 60, windowMs: 60 * 1000, prefix: "run_stream" });
  if (!rl.allowed && rl.response) return rl.response;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return new Response(JSON.stringify({ error: "Invalid run identifier" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = getSessionFromRequest(request);
  const supabase = createServerClient();

  // Verify run exists
  const { data: initialRun } = await supabase
    .from("research_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (!initialRun) {
    return new Response(JSON.stringify({ error: "Run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate tenant authorization
  const access = verifyWorkspaceAccess(session, initialRun.workspace_id);
  if (!access.isAuthorized) {
    return new Response(JSON.stringify({ error: "Forbidden: unauthorized workspace access" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let lastTaskId = "";
      let lastAccountsFingerprint = "";

      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial run state
      sendEvent("run_state", initialRun);

      const checkInterval = setInterval(async () => {
        try {
          // Fetch current run status
          const { data: run } = await supabase
            .from("research_runs")
            .select("*")
            .eq("id", id)
            .single();

          if (!run) {
            clearInterval(checkInterval);
            controller.close();
            isClosed = true;
            return;
          }

          sendEvent("run_progress", {
            status: run.status,
            current_step: run.current_step,
            progress_percent: run.progress_percent,
            leads_found: run.leads_found,
            leads_verified: run.leads_verified,
          });

          // Fetch recent tasks for live log streaming
          const { data: tasks } = await supabase
            .from("research_tasks")
            .select("*")
            .eq("run_id", id)
            .order("created_at", { ascending: true });

          if (tasks && tasks.length > 0) {
            const latestTask = tasks[tasks.length - 1];
            if (latestTask.id !== lastTaskId) {
              lastTaskId = latestTask.id;
              sendEvent("task_update", { tasks });
            }
          }

          // Company rows for this run, so the live grid fills cell by cell as nodes write them.
          const { data: accountRows } = await supabase
            .from("companies")
            .select(RUN_ACCOUNT_COLUMNS)
            .eq("workspace_id", run.workspace_id)
            .eq("run_id", id)
            .order("created_at", { ascending: true });
          const accounts = ((accountRows || []) as unknown as Record<string, unknown>[]).map(mapRunAccount);
          const fingerprint = accounts.map((a) => `${a.id}:${a.updatedAt}:${a.status}:${a.stage}`).join("|");
          if (fingerprint !== lastAccountsFingerprint) {
            lastAccountsFingerprint = fingerprint;
            sendEvent("account_update", { accounts });
          }

          // If run has finished or stopped, send final summary and close
          if (["completed", "stopped", "failed"].includes(run.status)) {
            // Fetch final companies and contacts discovered
            const { data: companies } = await supabase
              .from("companies")
              .select("*")
              .eq("workspace_id", run.workspace_id)
              .order("created_at", { ascending: false })
              .limit(run.target_count || 10);

            const { data: contacts } = await supabase
              .from("contacts")
              .select("*")
              .eq("workspace_id", run.workspace_id)
              .order("created_at", { ascending: false })
              .limit(run.target_count || 10);

            sendEvent("run_completed", {
              run,
              companies: companies || [],
              contacts: contacts || [],
            });

            clearInterval(checkInterval);
            controller.close();
            isClosed = true;
          }
        } catch (err) {
          console.error("Stream poll error:", err);
          clearInterval(checkInterval);
          if (!isClosed) controller.close();
          isClosed = true;
        }
      }, 1500);

      // Heartbeat every 15s to keep SSE connection alive
      const heartbeat = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeat);
          return;
        }
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(checkInterval);
        clearInterval(heartbeat);
        isClosed = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
