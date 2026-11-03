/**
 * AccountPipeline subgraph (one company):
 * extractSignals -> profileCompany -> scoreFit -> (below threshold: discard) -> findContacts
 * -> verifyContacts -> writeDossier -> persistAccount.
 * A stopGuard on every edge ends the branch within one node of a stop request.
 */

import { END, START, StateGraph } from "@langchain/langgraph";
import type { AgentDeps } from "../deps";
import { createFindContacts, createVerifyContacts } from "../nodes/account/contacts";
import { createWriteDossier } from "../nodes/account/dossier";
import { createPersistAccount } from "../nodes/account/persist";
import { createProfileCompany } from "../nodes/account/profile";
import { createExtractSignals, createScoreFit, passesFitThreshold } from "../nodes/account/signals";
import { stopRequested } from "../nodes/guards";
import { AccountState, type AccountStateType, type AccountUpdate } from "../state";
import { NETWORK_RETRY } from "./retry";

function createDiscard(deps: AgentDeps) {
  return async function discard(state: AccountStateType): Promise<AccountUpdate> {
    const reason =
      state.reason ||
      (state.score
        ? `Score ${state.score.combined} is below the threshold of ${state.context.minFitScore}.`
        : "Not scored.");
    try {
      await deps.repo.markDiscarded(state.context.workspaceId, state.candidate.domain, reason);
    } catch (e) {
      deps.logger.warn("Could not mark a discarded draft", { domain: state.candidate.domain, error: e instanceof Error ? e.message : String(e) });
    }
    return { outcome: "discarded", reason };
  };
}

function halted(): AccountUpdate {
  return { outcome: "stopped", reason: "Stop requested before this account finished." };
}

export function buildAccountPipeline(deps: AgentDeps) {
  const guardThen =
    <T extends string>(next: T) =>
    async (state: AccountStateType): Promise<T | "halted"> =>
      (await stopRequested(deps, state.context.runId)) ? "halted" : next;

  const afterScore = async (state: AccountStateType): Promise<"halted" | "findContacts" | "discard"> => {
    if (await stopRequested(deps, state.context.runId)) return "halted";
    return passesFitThreshold(state) ? "findContacts" : "discard";
  };

  return new StateGraph(AccountState)
    .addNode("extractSignals", createExtractSignals(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("profileCompany", createProfileCompany(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("scoreFit", createScoreFit(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("discard", createDiscard(deps))
    .addNode("findContacts", createFindContacts(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("verifyContacts", createVerifyContacts(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("writeDossier", createWriteDossier(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("persistAccount", createPersistAccount(deps), { retryPolicy: NETWORK_RETRY })
    .addNode("halted", halted)
    .addEdge(START, "extractSignals")
    .addConditionalEdges("extractSignals", guardThen("profileCompany"), ["profileCompany", "halted"])
    .addConditionalEdges("profileCompany", guardThen("scoreFit"), ["scoreFit", "halted"])
    .addConditionalEdges("scoreFit", afterScore, ["findContacts", "discard", "halted"])
    .addConditionalEdges("findContacts", guardThen("verifyContacts"), ["verifyContacts", "halted"])
    .addConditionalEdges("verifyContacts", guardThen("writeDossier"), ["writeDossier", "halted"])
    .addConditionalEdges("writeDossier", guardThen("persistAccount"), ["persistAccount", "halted"])
    .addEdge("persistAccount", END)
    .addEdge("discard", END)
    .addEdge("halted", END)
    .compile({ checkpointer: false, name: "AccountPipeline" });
}

export type AccountPipelineGraph = ReturnType<typeof buildAccountPipeline>;
