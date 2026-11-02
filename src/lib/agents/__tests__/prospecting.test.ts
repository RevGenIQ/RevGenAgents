import { Command, MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";
import { buildAccountPipeline } from "../graphs/accountPipeline";
import { buildProspectingGraph } from "../graphs/prospecting";
import { fallbackPlan } from "../nodes/context";
import { validateSignals } from "../nodes/account/signals";
import { EMPTY_ICP } from "../state";
import type { ReviewRequest } from "../types";
import { createDeps, createFakeRepo, createFakeTools, HITS, NOW, RUN_ID, WORKSPACE_ID } from "./fakes";

const thread = (id = RUN_ID) => ({ configurable: { thread_id: id } });

function setup(options: Parameters<typeof createFakeRepo>[0] = {}, toolCost?: number, budgetPerLeadUsd?: number) {
  const { repo, state } = createFakeRepo(options);
  const tools = createFakeTools({ costPerCall: toolCost });
  const deps = createDeps(repo, tools, budgetPerLeadUsd !== undefined ? { budgetPerLeadUsd } : {});
  const graph = buildProspectingGraph(deps, new MemorySaver());
  return { repo, state, tools, deps, graph };
}

async function pendingReview(graph: ReturnType<typeof setup>["graph"], id = RUN_ID): Promise<ReviewRequest | undefined> {
  const snapshot = await graph.getState(thread(id));
  return snapshot.tasks.flatMap((t) => t.interrupts || []).map((i) => i.value as ReviewRequest)[0];
}

describe("ProspectingGraph", () => {
  it("feeds discovered companies into the AccountPipeline fan-out and drops DNC accounts", async () => {
    const { graph, tools, state } = setup();
    await graph.invoke({ runId: RUN_ID }, thread());

    const extractCalls = tools.llmMock.mock.calls.filter(([task]) => task === "extractSignals");
    expect(extractCalls).toHaveLength(2);
    expect(extractCalls.map(([, , p]) => p.user).join(" ")).not.toContain("Blocked Co");
    expect([...state.companies.values()].map((c) => c.domain)).toEqual(["acme-robotics.com"]);
  });

  it("discards a company whose fit score is below the threshold", async () => {
    const { graph, tools, state } = setup();
    await graph.invoke({ runId: RUN_ID }, thread());

    const values = (await graph.getState(thread())).values;
    const lowfit = values.accountResults.find((r: { domain: string }) => r.domain === "lowfit.io");
    expect(lowfit?.outcome).toBe("discarded");
    expect(tools.findContact).toHaveBeenCalledTimes(1);
    expect(tools.findContact).toHaveBeenCalledWith("Acme Robotics", "acme-robotics.com", ["VP Operations"]);
    expect([...state.companies.values()].some((c) => c.domain === "lowfit.io")).toBe(false);
  });

  it("pauses at humagentReview and resumes with the reviewer's decisions", async () => {
    const { graph, repo, state } = setup();
    await graph.invoke({ runId: RUN_ID }, thread());

    const snapshot = await graph.getState(thread());
    expect(snapshot.next).toContain("humagentReview");
    const review = await pendingReview(graph);
    expect(review?.cards).toHaveLength(1);
    expect(repo.publishCompanies).not.toHaveBeenCalled();

    const companyId = review!.cards[0].companyId;
    await graph.invoke(new Command({ resume: { decisions: [{ companyId, action: "approve" }] } }), thread());

    expect(repo.publishCompanies).toHaveBeenCalledWith(WORKSPACE_ID, [companyId]);
    expect(state.messages).toHaveLength(1);
    expect(state.runPatches.at(-1)).toMatchObject({ status: "completed", leads_found: 1, leads_verified: 1 });
    expect(state.usageRows).toBeGreaterThan(0);
    expect(state.audits).toContain("run_completed");
    expect((await graph.getState(thread())).next).toHaveLength(0);
  });

  it("ignores review decisions for accounts that were not in the review", async () => {
    const { graph, repo } = setup();
    await graph.invoke({ runId: RUN_ID }, thread());
    await graph.invoke(
      new Command({ resume: { decisions: [{ companyId: "company-999", action: "approve" }] } }),
      thread()
    );
    expect(repo.publishCompanies).toHaveBeenCalledWith(WORKSPACE_ID, []);
  });

  it("halts when the stop flag is set", async () => {
    const { graph, tools, state } = setup({ stop: true });
    await graph.invoke({ runId: RUN_ID }, thread());

    expect(tools.search).not.toHaveBeenCalled();
    expect(state.companies.size).toBe(0);
    expect(state.runPatches.at(-1)).toMatchObject({ status: "stopped" });
    expect((await graph.getState(thread())).values.stopReason).toBe("Stopped by user request.");
  });

  it("aborts at the time budget and continues the same thread from its checkpoint", async () => {
    const { graph, tools, state } = setup();
    const slowVerify = tools.verifyEmail.getMockImplementation()!;
    tools.verifyEmail.mockImplementationOnce(async (email: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return slowVerify(email);
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    await expect(graph.invoke({ runId: RUN_ID }, { ...thread(), signal: controller.signal })).rejects.toThrow();
    expect((await graph.getState(thread())).next).toContain("accountPipeline");

    await graph.invoke(null, thread());
    expect((await pendingReview(graph))?.cards).toHaveLength(1);
    // Completed supersteps are not repeated after the continuation.
    expect(tools.llmMock.mock.calls.filter(([task]) => task === "discoverCompanies")).toHaveLength(1);
    expect(state.companies.size).toBe(1);
  });

  it("marks the run failed, not completed, when an LLM provider error leaves nothing researched", async () => {
    const { graph, tools, state } = setup();
    tools.llmMock.mockImplementation(async () => ({
      ok: false as const,
      error: { code: "HTTP_ERROR" as const, message: "OpenAI HTTP 429: no credits remaining" },
      usage: [],
    }));
    await graph.invoke({ runId: RUN_ID }, thread());

    const last = state.runPatches[state.runPatches.length - 1];
    expect(last.status).toBe("failed");
    expect(String(last.error_message)).toContain("429");
    expect(String(last.current_step)).toContain("Run failed");
  });

  it("stays completed when search works but finds no companies", async () => {
    const { graph, tools, state } = setup();
    tools.search.mockImplementation(async () => ({ ok: true as const, value: [], usage: [] }));
    await graph.invoke({ runId: RUN_ID }, thread());

    const last = state.runPatches[state.runPatches.length - 1];
    expect(last.status).toBe("completed");
    expect(last.error_message).toBeNull();
  });

  it("stops with a reason when the run budget is exceeded", async () => {
    const { graph, state, tools } = setup({}, 5, 0.01);
    await graph.invoke({ runId: RUN_ID }, thread());

    expect(tools.findContact).not.toHaveBeenCalled();
    const last = state.runPatches.at(-1);
    expect(last?.status).toBe("stopped");
    expect(last?.error_message).toMatch(/budget exceeded/i);
  });
});

describe("persistAccount idempotency", () => {
  it("creates no duplicate rows when the same account is processed twice", async () => {
    const { repo, state } = createFakeRepo();
    const deps = createDeps(repo, createFakeTools());
    const pipeline = buildAccountPipeline(deps);
    const input = {
      context: { runId: RUN_ID, workspaceId: WORKSPACE_ID, icp: { ...EMPTY_ICP, requiredSignals: ["new plant"] }, personas: ["VP Operations"], minFitScore: 70 },
      candidate: { name: "Acme Robotics", domain: "acme-robotics.com", industry: "Industrial robotics", country: "Germany", whyItMatches: "", sources: [HITS.acme] },
    };

    const first = await pipeline.invoke(input);
    const second = await pipeline.invoke(input);

    expect(first.outcome).toBe("persisted");
    expect(second.companyId).toBe(first.companyId);
    expect(repo.upsertCompany).toHaveBeenCalledTimes(2);
    expect(state.companies.size).toBe(1);
    expect(state.contacts.size).toBe(1);
    expect(state.signals).toHaveLength(1);
    expect(state.dossiers.size).toBe(1);
  });

  it("does not deliver an account again once it has been published", async () => {
    const { graph, state } = setup();
    await graph.invoke({ runId: RUN_ID }, thread());
    const review = await pendingReview(graph);
    await graph.invoke(new Command({ resume: { decisions: [{ companyId: review!.cards[0].companyId, action: "approve" }] } }), thread());

    const secondRun = "33333333-3333-4333-8333-333333333333";
    await graph.invoke({ runId: secondRun }, thread(secondRun));
    expect(await pendingReview(graph, secondRun)).toBeUndefined();
    expect(state.companies.size).toBe(1);
  });
});

describe("evidence and planning rules", () => {
  it("drops signals without a retrieved source, a matching quote or a date", () => {
    const evidence = new Map([[HITS.acme.url, { ...HITS.acme }]]);
    const undated = new Map([[HITS.acme.url, { ...HITS.acme, publishedDate: null }]]);
    const base = { signalType: "expansion", title: "Plant", quote: "will open a new robotics plant in Munich", sourceUrl: HITS.acme.url, sourceDate: "2026-09-15" };

    expect(validateSignals([base], evidence, 365, NOW)).toHaveLength(1);
    expect(validateSignals([{ ...base, sourceUrl: "https://invented.example.com/x" }], evidence, 365, NOW)).toHaveLength(0);
    expect(validateSignals([{ ...base, quote: "doubled revenue to 4 billion last quarter" }], evidence, 365, NOW)).toHaveLength(0);
    expect(validateSignals([{ ...base, sourceDate: null }], undated, 365, NOW)).toHaveLength(0);
    expect(validateSignals([{ ...base, sourceDate: "2024-01-01" }], evidence, 365, NOW)).toHaveLength(0);
  });

  it("builds different, ICP-specific queries for different workspaces", () => {
    const a = fallbackPlan({ ...EMPTY_ICP, industries: ["Industrial robotics"], geographies: ["Germany"] }, 6, 2026);
    const b = fallbackPlan({ ...EMPTY_ICP, industries: ["Dental clinics"], geographies: ["Brazil"], requiredSignals: ["new location"] }, 6, 2026);

    expect(a.queries).not.toEqual(b.queries);
    expect(a.queries.every((q) => q.includes("Industrial robotics") && q.includes("Germany"))).toBe(true);
    expect(b.queries.every((q) => q.includes("Dental clinics") && q.includes("Brazil") && q.includes("new location"))).toBe(true);
  });
});
