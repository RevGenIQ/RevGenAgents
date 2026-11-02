/**
 * Cross-cutting helpers: progress reporting for the SSE route, stop and budget
 * guards used on conditional edges, and usage arithmetic.
 */

import type { AgentDeps, TaskInput, TaskStatus } from "../deps";
import type { RunBudget, UsageEntry } from "../types";

/**
 * Writes current_step / progress_percent. Progress is best-effort: a failed write
 * is logged but never aborts research work.
 */
export async function reportProgress(
  deps: AgentDeps,
  runId: string,
  step: string,
  percent: number
): Promise<void> {
  try {
    await deps.repo.updateRun(runId, {
      current_step: step,
      progress_percent: Math.max(0, Math.min(100, Math.round(percent))),
    });
  } catch (e) {
    deps.logger.warn("Progress update failed", { runId, step, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Inserts a research_tasks row for the live log; returns null when the write fails. */
export async function startTask(deps: AgentDeps, task: Omit<TaskInput, "status">): Promise<string | null> {
  try {
    return await deps.repo.recordTask({ ...task, status: "running" });
  } catch (e) {
    deps.logger.warn("Task log insert failed", { taskType: task.taskType, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export async function finishTask(
  deps: AgentDeps,
  taskId: string | null,
  status: TaskStatus,
  output: Record<string, unknown>
): Promise<void> {
  if (!taskId) return;
  try {
    await deps.repo.completeTask(taskId, status, output);
  } catch (e) {
    deps.logger.warn("Task log update failed", { taskId, error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * stopGuard: reads research_runs.stop_requested. If the check itself fails the run
 * continues (a transient read error must not look like a user stop), and the
 * failure is logged.
 */
export async function stopRequested(deps: AgentDeps, runId: string): Promise<boolean> {
  try {
    return await deps.repo.isStopRequested(runId);
  } catch (e) {
    deps.logger.warn("Stop check failed; continuing", { runId, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export function totalCost(usage: UsageEntry[]): number {
  return Number(usage.reduce((sum, u) => sum + u.costUsd, 0).toFixed(5));
}

export function countCalls(usage: UsageEntry[], predicate: (u: UsageEntry) => boolean): number {
  return usage.filter(predicate).reduce((sum, u) => sum + u.calls, 0);
}

const isLlm = (u: UsageEntry) => u.eventType.startsWith("llm_");
const isSearch = (u: UsageEntry) => u.eventType === "web_search";

/** budgetGuard: returns a human-readable reason when any run budget is exhausted. */
export function budgetExceededReason(usage: UsageEntry[], budget: RunBudget): string | null {
  const cost = totalCost(usage);
  if (budget.maxCostUsd > 0 && cost > budget.maxCostUsd) {
    return `Run budget exceeded: $${cost.toFixed(2)} spent of $${budget.maxCostUsd.toFixed(2)} allowed.`;
  }
  const llmCalls = countCalls(usage, isLlm);
  if (budget.maxLlmCalls > 0 && llmCalls > budget.maxLlmCalls) {
    return `LLM call budget exceeded: ${llmCalls} of ${budget.maxLlmCalls} calls.`;
  }
  const searches = countCalls(usage, isSearch);
  if (budget.maxSearches > 0 && searches > budget.maxSearches) {
    return `Search budget exceeded: ${searches} of ${budget.maxSearches} searches.`;
  }
  return null;
}

/** Groups usage by provider and event type for usage_events rows. */
export function summariseUsage(usage: UsageEntry[]): UsageEntry[] {
  const groups = usage.reduce<Record<string, UsageEntry>>((acc, u) => {
    const key = `${u.provider}::${u.eventType}`;
    const prev = acc[key];
    return {
      ...acc,
      [key]: prev
        ? {
            ...prev,
            calls: prev.calls + u.calls,
            tokens: prev.tokens + u.tokens,
            costUsd: Number((prev.costUsd + u.costUsd).toFixed(5)),
          }
        : { ...u },
    };
  }, {});
  return Object.values(groups);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
