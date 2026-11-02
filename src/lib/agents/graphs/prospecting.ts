/**
 * ProspectingGraph (thread_id = research_runs.id):
 * loadContext -> planQueries -> discoverCompanies -> dedupeFilter
 * -> Send fan-out to accountPipeline (one AccountPipeline subgraph per company)
 * -> aggregate -> humagentReview (interrupt) -> publishToClient -> finalize.
 * stopGuard and budgetGuard sit on the conditional edges and route to halt -> finalize.
 */

import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { END, Send, START, StateGraph } from "@langchain/langgraph";
import type { AgentDeps } from "../deps";
import { createLoadContext, createPlanQueries } from "../nodes/context";
import { createDedupeFilter, createDiscoverCompanies } from "../nodes/discovery";
import { budgetExceededReason, errorMessage, stopRequested } from "../nodes/guards";
import {
  createAggregate,
  createFinalize,
  createHalt,
  createHumagentReview,
  createPublishToClient,
  reviewCards,
} from "../nodes/review";
import {
  AccountTaskInput,
  ProspectingState,
  type AccountTaskContext,
  type ProspectingStateType,
  type ProspectingUpdate,
} from "../state";
import type { AccountResult } from "../types";
import { buildAccountPipeline } from "./accountPipeline";
import { NETWORK_RETRY } from "./retry";

type TaskInput = typeof AccountTaskInput.State;

function createAccountPipelineNode(deps: AgentDeps) {
  const pipeline = buildAccountPipeline(deps);

  return async function accountPipeline(
    input: TaskInput,
    config?: { signal?: AbortSignal }
  ): Promise<ProspectingUpdate> {
    const { context, candidate } = input.task;
    try {
      const final = await pipeline.invoke({ context, candidate }, { signal: config?.signal });
      const verifiedContacts = final.verified.filter((c) => c.verified).length;
      const contact = final.verified[0];
      const result: AccountResult = {
        name: candidate.name,
        domain: candidate.domain,
        outcome: final.outcome ?? "failed",
        reason: final.reason,
        companyId: final.companyId,
        score: final.score ? final.score.combined : null,
        signals: final.signals.length,
        verifiedContacts,
        headline: final.signals[0]?.title ?? "",
        contactSummary: contact
          ? `${contact.firstName} ${contact.lastName}, ${contact.title} (${contact.verified ? "verified" : "unverified"})`
          : "No named contact found",
      };
      return { accountResults: [result], usage: final.usage };
    } catch (e) {
      // An aborted invocation must not record a result: the branch re-runs on continue.
      if (config?.signal?.aborted) throw e;
      deps.logger.error(`AccountPipeline failed for ${candidate.domain}`, e);
      const failed: AccountResult = {
        name: candidate.name,
        domain: candidate.domain,
        outcome: "failed",
        reason: errorMessage(e),
        companyId: null,
        score: null,
        signals: 0,
        verifiedContacts: 0,
        headline: "",
        contactSummary: "",
      };
      return { accountResults: [failed], errors: [`${candidate.domain}: ${errorMessage(e)}`] };
    }
  };
}

export function buildProspectingGraph(deps: AgentDeps, checkpointer: BaseCheckpointSaver) {
  const shouldHalt = async (state: ProspectingStateType): Promise<boolean> =>
    (await stopRequested(deps, state.runId)) || budgetExceededReason(state.usage, state.budget) !== null;

  const afterPlan = async (state: ProspectingStateType) =>
    (await shouldHalt(state)) ? "halt" : "discoverCompanies";

  const afterDiscover = async (state: ProspectingStateType) =>
    (await shouldHalt(state)) ? "halt" : "dedupeFilter";

  const fanOut = async (state: ProspectingStateType) => {
    if (await shouldHalt(state)) return "halt";
    if (state.candidates.length === 0) return "aggregate";
    const context: AccountTaskContext = {
      runId: state.runId,
      workspaceId: state.workspaceId,
      icp: state.icp,
      personas: state.personas,
      minFitScore: state.minFitScore,
    };
    return state.candidates.map((candidate) => new Send("accountPipeline", { task: { context, candidate } }));
  };

  const afterAggregate = async (state: ProspectingStateType) => {
    if (await shouldHalt(state)) return "halt";
    return reviewCards(state).length > 0 ? "humagentReview" : "finalize";
  };

  const afterReview = async (state: ProspectingStateType) =>
    (await stopRequested(deps, state.runId)) ? "halt" : "publishToClient";

  return new StateGraph(ProspectingState)
    .addNode("loadContext", createLoadContext(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("planQueries", createPlanQueries(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("discoverCompanies", createDiscoverCompanies(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("dedupeFilter", createDedupeFilter(deps))
    .addNode("accountPipeline", createAccountPipelineNode(deps), { input: AccountTaskInput })
    .addNode("aggregate", createAggregate(deps))
    .addNode("humagentReview", createHumagentReview(deps))
    .addNode("publishToClient", createPublishToClient(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("halt", createHalt(deps))
    .addNode("finalize", createFinalize(deps), { retryPolicy: NETWORK_RETRY })
    .addEdge(START, "loadContext")
    .addEdge("loadContext", "planQueries")
    .addConditionalEdges("planQueries", afterPlan, ["discoverCompanies", "halt"])
    .addConditionalEdges("discoverCompanies", afterDiscover, ["dedupeFilter", "halt"])
    .addConditionalEdges("dedupeFilter", fanOut, ["accountPipeline", "aggregate", "halt"])
    .addEdge("accountPipeline", "aggregate")
    .addConditionalEdges("aggregate", afterAggregate, ["humagentReview", "finalize", "halt"])
    .addConditionalEdges("humagentReview", afterReview, ["publishToClient", "halt"])
    .addEdge("publishToClient", "finalize")
    .addEdge("halt", "finalize")
    .addEdge("finalize", END)
    .compile({ checkpointer, name: "ProspectingGraph" });
}

export type ProspectingGraph = ReturnType<typeof buildProspectingGraph>;
