/**
 * Agent runtime configuration.
 * Every tunable comes from the environment with a documented default, so
 * thresholds, budgets and cost estimates can change without a code change.
 */

function numberFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export interface AgentCostTable {
  searchUsd: number;
  extractUsd: number;
  llmPer1kTokensUsd: number;
  enrichUsd: number;
  verifyUsd: number;
}

export interface AgentConfig {
  /** Wall-clock budget for one invocation; the caller continues the thread afterwards. */
  timeBudgetMs: number;
  /** Parallel AccountPipeline branches per superstep. */
  maxConcurrency: number;
  /** Planned search queries per run. */
  maxQueries: number;
  /** Overrides the run's min_icp_score when set. */
  minFitScoreOverride: number | null;
  /** Default spend ceiling per verified lead; the run budget is this times target_count. */
  budgetPerLeadUsd: number;
  maxLlmCallsPerRun: number;
  maxSearchesPerRun: number;
  costs: AgentCostTable;
}

export function loadAgentConfig(): AgentConfig {
  const minFit = process.env.AGENT_MIN_FIT_SCORE;
  return {
    timeBudgetMs: numberFromEnv("AGENT_TIME_BUDGET_MS", 240_000, 30_000, 285_000),
    maxConcurrency: numberFromEnv("AGENT_MAX_CONCURRENCY", 4, 1, 16),
    maxQueries: numberFromEnv("AGENT_MAX_QUERIES", 6, 1, 20),
    minFitScoreOverride:
      minFit && minFit.trim() !== "" ? numberFromEnv("AGENT_MIN_FIT_SCORE", 70, 0, 100) : null,
    budgetPerLeadUsd: numberFromEnv("AGENT_BUDGET_PER_LEAD_USD", 1.5, 0.01, 100),
    maxLlmCallsPerRun: numberFromEnv("MAX_LLM_CALLS_PER_RUN", 300, 1, 10_000),
    maxSearchesPerRun: numberFromEnv("MAX_SEARCHES_PER_RUN", 150, 1, 10_000),
    costs: {
      searchUsd: numberFromEnv("AGENT_COST_SEARCH_USD", 0.005, 0, 10),
      extractUsd: numberFromEnv("AGENT_COST_EXTRACT_USD", 0.008, 0, 10),
      llmPer1kTokensUsd: numberFromEnv("AGENT_COST_LLM_PER_1K_TOKENS_USD", 0.0006, 0, 10),
      enrichUsd: numberFromEnv("AGENT_COST_ENRICH_USD", 0.03, 0, 10),
      verifyUsd: numberFromEnv("AGENT_COST_VERIFY_USD", 0.008, 0, 10),
    },
  };
}
