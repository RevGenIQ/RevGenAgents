/**
 * In-memory AgentRepo and scripted AgentTools for graph tests.
 * The fake repo enforces the same idempotency keys as the Supabase schema so
 * duplicate writes show up as extra rows.
 */

import { vi } from "vitest";
import type * as z from "zod";
import { loadAgentConfig, type AgentConfig } from "../config";
import type { AgentDeps, AgentRepo, AgentTools, LlmPrompt, LlmTask, RunPatch, ToolOutcome } from "../deps";
import type { ContactCandidate, SourceSnippet, UsageEntry } from "../types";

export const NOW = new Date("2026-11-02T12:00:00Z");
export const RUN_ID = "11111111-1111-4111-8111-111111111111";
export const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

export const HITS: Record<string, SourceSnippet> = {
  acme: {
    url: "https://news.example.org/acme-munich-plant",
    title: "Acme Robotics opens new plant in Munich",
    content: "Acme Robotics announced it will open a new robotics plant in Munich to expand production capacity.",
    publishedDate: "2026-09-15",
  },
  lowfit: {
    url: "https://news.example.org/lowfit-update",
    title: "Lowfit Ltd announces office move",
    content: "Lowfit Ltd announced it is moving its head office to a larger building in Berlin next spring.",
    publishedDate: "2026-08-01",
  },
  dnc: {
    url: "https://news.example.org/blocked-co-funding",
    title: "Blocked Co raises funding",
    content: "Blocked Co raised a new funding round to expand its robotics business in Germany.",
    publishedDate: "2026-07-01",
  },
};

const usage = (provider: string, eventType: string, costUsd = 0.001): UsageEntry[] => [
  { provider, eventType, calls: 1, tokens: 0, costUsd },
];

function ok<T>(value: T, u: UsageEntry[]): ToolOutcome<T> {
  return { ok: true, value, usage: u };
}

function signalFor(prompt: string) {
  const hit = prompt.includes("Acme Robotics") ? HITS.acme : HITS.lowfit;
  const quote = prompt.includes("Acme Robotics")
    ? "will open a new robotics plant in Munich"
    : "moving its head office to a larger building";
  return { signals: [{ signalType: "expansion", title: hit.title, quote, sourceUrl: hit.url, sourceDate: hit.publishedDate }] };
}

function llmResponse(task: LlmTask, user: string): unknown {
  switch (task) {
    case "planQueries":
      return {
        queries: ['"industrial robotics" companies Germany expansion 2026', "industrial robotics Germany new plant"],
        personas: ["VP Operations"],
      };
    case "discoverCompanies":
      return {
        companies: [
          { name: "Acme Robotics", domain: "https://www.acme-robotics.com", industry: "Industrial robotics", country: "Germany", whyItMatches: "New plant", sourceUrls: [HITS.acme.url] },
          { name: "Lowfit Ltd", domain: "lowfit.io", industry: "Office services", country: "Germany", whyItMatches: "Office move", sourceUrls: [HITS.lowfit.url] },
          { name: "Blocked Co", domain: "blocked.co", industry: "Industrial robotics", country: "Germany", whyItMatches: "Funding", sourceUrls: [HITS.dnc.url] },
        ],
      };
    case "extractSignals":
      return signalFor(user);
    case "scoreFit":
      return user.includes("Acme Robotics")
        ? { fitScore: 92, intentScore: 88, rationale: "Industrial robotics maker in Germany opening a new plant." }
        : { fitScore: 20, intentScore: 15, rationale: "Office services company; not in the ICP." };
    case "writeDossier":
      return {
        summary: "Acme Robotics is opening a new robotics plant in Munich.",
        opener: "Hi Dana, congratulations on the new Munich plant announced in September.",
        talkingPoints: ["New Munich robotics plant"],
        painPoint: "Ramping a new production site",
      };
  }
}

export interface FakeToolsOptions {
  costPerCall?: number;
}

export function createFakeTools(options: FakeToolsOptions = {}) {
  const cost = options.costPerCall ?? 0.001;
  const contact: ContactCandidate = {
    firstName: "Dana",
    lastName: "Weber",
    title: "VP Operations",
    seniority: "VP",
    department: "Operations",
    workEmail: "dana.weber@acme-robotics.com",
    linkedinUrl: "https://www.linkedin.com/in/dana-weber",
    phone: null,
    roleStartDate: "2024-01-01",
    roleConfirmed: true,
    emailSource: "provider",
    evidenceNote: "Apollo match",
  };

  const llmImpl = async <T,>(task: LlmTask, schema: z.ZodType<T>, prompt: LlmPrompt): Promise<ToolOutcome<T>> => {
    const parsed = schema.safeParse(llmResponse(task, prompt.user));
    if (!parsed.success) {
      return { ok: false, error: { code: "SCHEMA_MISMATCH", message: parsed.error.message }, usage: usage("gemini", `llm_${task}`, cost) };
    }
    return ok(parsed.data, usage("gemini", `llm_${task}`, cost));
  };
  const llmMock = vi.fn(llmImpl);

  const tools = {
    search: vi.fn(async (query: string) => {
      if (query.includes('"Acme Robotics"')) return ok([HITS.acme], usage("brave", "web_search", cost));
      if (query.includes('"Lowfit Ltd"')) return ok([HITS.lowfit], usage("brave", "web_search", cost));
      return ok([HITS.acme, HITS.lowfit, HITS.dnc], usage("brave", "web_search", cost));
    }),
    extract: vi.fn(async () => ok([], usage("tavily", "page_extract", cost))),
    findContact: vi.fn(async (_companyName: string, domain: string) =>
      ok<ContactCandidate | null>(domain === "acme-robotics.com" ? contact : null, usage("apollo", "contact_enrichment", cost))
    ),
    verifyEmail: vi.fn(async (email: string) => ok({ status: "deliverable" as const, reason: `valid: ${email}` }, usage("zerobounce", "email_verification", cost))),
  };
  // vi.fn() erases the generic signature of llm, so the typed implementation is exposed as llm
  // and the mock (for call assertions) as llmMock.
  const agentTools: AgentTools = { ...tools, llm: llmMock as unknown as AgentTools["llm"] };
  return { ...tools, llm: agentTools.llm, llmMock };
}

export function createFakeRepo(options: { stop?: boolean; dncDomains?: string[]; icpBrief?: Record<string, unknown> } = {}) {
  const state = {
    stop: options.stop ?? false,
    runPatches: [] as RunPatch[],
    companies: new Map<string, { id: string; domain: string; stage: string }>(),
    contacts: new Map<string, { id: string; companyId: string }>(),
    signals: [] as Array<{ companyId: string; url: string }>,
    dossiers: new Map<string, string>(),
    messages: [] as string[],
    usageRows: 0,
    audits: [] as string[],
  };
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const repo = {
    getRun: vi.fn(async (runId: string) => ({
      id: runId,
      workspaceId: WORKSPACE_ID,
      status: "queued",
      targetCount: 5,
      minIcpScore: 70,
      icpInput: {},
    })),
    getWorkspace: vi.fn(async () => ({
      id: WORKSPACE_ID,
      name: "Client Co",
      icpBrief: options.icpBrief ?? {
        offering: "Predictive maintenance software",
        targetIndustries: ["Industrial robotics"],
        geographies: ["Germany"],
        buyerFunctions: ["Operations"],
        seniorityLevels: ["VP"],
        requiredSignals: ["new plant", "expansion"],
        signalWindowDays: 365,
      },
      dncEntries: (options.dncDomains ?? ["blocked.co"]).map((domain) => ({ domain, companyName: domain, location: "" })),
    })),
    listDeliveredDomains: vi.fn(async () =>
      [...state.companies.values()].filter((c) => c.stage === "published_to_client").map((c) => c.domain)
    ),
    isStopRequested: vi.fn(async () => state.stop),
    updateRun: vi.fn(async (_runId: string, patch: RunPatch) => {
      state.runPatches.push(patch);
    }),
    recordTask: vi.fn(async () => nextId("task")),
    completeTask: vi.fn(async () => undefined),
    upsertCompany: vi.fn(async (row: { workspaceId: string; domain: string }) => {
      const key = `${row.workspaceId}|${row.domain}`;
      const existing = state.companies.get(key);
      if (existing) return existing.id;
      const id = nextId("company");
      state.companies.set(key, { id, domain: row.domain, stage: "human_agent_queue" });
      return id;
    }),
    upsertContact: vi.fn(async (row: { workspaceId: string; workEmail: string; companyId: string }) => {
      const key = `${row.workspaceId}|${row.workEmail}`;
      const existing = state.contacts.get(key);
      if (existing) return existing.id;
      const id = nextId("contact");
      state.contacts.set(key, { id, companyId: row.companyId });
      return id;
    }),
    insertSignals: vi.fn(async (_ws: string, companyId: string, rows: Array<{ sourceUrl: string }>) => {
      const fresh = rows.filter((r) => !state.signals.some((s) => s.companyId === companyId && s.url === r.sourceUrl));
      fresh.forEach((r) => state.signals.push({ companyId, url: r.sourceUrl }));
      return fresh.length;
    }),
    upsertDossier: vi.fn(async (row: { workspaceId: string; companyId: string }) => {
      const key = `${row.workspaceId}|${row.companyId}`;
      const existing = state.dossiers.get(key);
      if (existing) return existing;
      const id = nextId("dossier");
      state.dossiers.set(key, id);
      return id;
    }),
    publishCompanies: vi.fn(async (_ws: string, ids: string[]) =>
      [...state.companies.entries()]
        .filter(([, c]) => ids.includes(c.id))
        .map(([key, c]) => {
          state.companies.set(key, { ...c, stage: "published_to_client" });
          return { id: c.id, name: c.domain, domain: c.domain };
        })
    ),
    postSystemMessage: vi.fn(async (_ws: string, content: string) => {
      state.messages.push(content);
    }),
    insertUsageEvents: vi.fn(async (rows: unknown[]) => {
      state.usageRows += rows.length;
    }),
    insertAuditLog: vi.fn(async (row: { action: string }) => {
      state.audits.push(row.action);
    }),
  };
  return { repo: repo satisfies AgentRepo, state };
}

export function createDeps(
  repo: AgentRepo,
  tools: AgentTools,
  overrides: Partial<AgentConfig> = {}
): AgentDeps {
  return {
    repo,
    tools,
    config: { ...loadAgentConfig(), minFitScoreOverride: null, ...overrides },
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    now: () => NOW,
  };
}
