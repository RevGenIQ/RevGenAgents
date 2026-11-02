# RevGen IQ — Product Requirements Document

| | |
|---|---|
| Status | Draft v1 · 2026-11-02 |
| Owner | Founder (RevGenIQ) |
| Scope | v1: ICP-driven, human-verified account cards delivered through the Client portal, produced by a LangGraph agent system |

Assumptions are marked **[A]**. They were inferred from the current codebase and conversation, not confirmed with the founder.

---

## 1. Problem statement
B2B sales teams spend most of their prospecting time finding accounts that fit their ICP, proving those accounts are in a buying window, and identifying the right decision maker with a working email. Contact databases are stale and not tied to timely buying signals. AI tools that generate lead lists invent contacts and "verified" claims, which wastes outreach and damages sender reputation.

RevGen IQ delivers a small number of **evidence-backed, human-verified account cards** per month. Each card states why the company fits, why now (dated signals with source links), and who to contact (a confirmed person with a deliverable email).

## 2. Goals
1. **Truthful output:** 100% of cards marked "verified" have a provider-confirmed role, a deliverable email and at least one buying signal with a source link and date. Zero fabricated contacts reach a client.
2. **Fast first value:** the first ~5 sample cards are delivered within 24h of an approved ICP brief.
3. **Unit economics:** the average third-party API and LLM cost per verified lead stays under a set budget **[A: ≤ $1.50]**, tracked per run.
4. **Quality accepted by clients:** fewer than 10% of delivered cards are challenged by the client and upheld.
5. **Any ICP, any seller:** the system produces results for any client's ICP with no seller-specific code.

## 3. Non-goals (v1)
- **Sending email or running sequences.** RevGen delivers openers only; clients send from their own tools (CRM integrations are P2).
- **Self-serve signup with instant access.** Access stays Admin-approved for quality control.
- **A bulk contact-database product.** We sell few, verified cards, not volume.
- **Payments and billing automation.** Credits are recorded but invoicing is manual **[A]**.
- **Native mobile apps.** The web is responsive only.

## 4. Personas
- **Client spokesperson:** a seller at a B2B company. Submits and updates the ICP and do-not-contact (DNC) list, reviews cards, gives feedback, challenges bad cards, exports.
- **Humagent:** an internal human QA specialist assigned to client workspaces. Reviews agent output, edits and verifies contacts, and publishes cards to the client.
- **Admin:** the operator. Approves clients, creates and assigns Humagents, monitors runs, cost and quality, and resolves challenges.

## 5. User stories
**Client**
- As a Client, I want to describe my ICP (industries, geographies, size, personas, required signals, offering) so that the research targets my real market.
- As a Client, I want to upload a DNC list so that existing customers and opportunities are never delivered.
- As a Client, I want each card to show the fit reason, dated signals with source links, and a verified contact, so that I can trust it without re-researching.
- As a Client, I want to challenge a card with a reason so that bad fits are reviewed and the targeting improves.
- As a Client, I want to chat with my Humagent and the Admin in one channel so that feedback loops are fast.
- Edge cases: if no card meets the bar, I see an honest empty state and an ETA, never filler. A card with unverified contacts says so.

**Humagent**
- As a Humagent, I want runs to pause with the candidate cards for my review so that nothing reaches a client without human QA.
- As a Humagent, I want to approve, edit or reject each card and have my decision resume the run so that delivery continues without engineering help.
- As a Humagent, I only see workspaces assigned to me.

**Admin**
- As an Admin, I want to approve access requests and issue credentials once, securely.
- As an Admin, I want to see each run's progress, cost, provider calls and failure reasons so that I can control quality and margin.
- As an Admin, I want to resolve challenges and adjust credits.

## 6. Requirements

### P0 — must have
| ID | Requirement | Acceptance criteria |
|---|---|---|
| P0-1 | **ICP-driven query planning.** Search plans are generated from the workspace's ICP brief. | Given two workspaces with different ICPs, the generated queries differ and contain each ICP's industries and geographies. No seller-specific constants remain in code. |
| P0-2 | **LangGraph prospecting graph** with the nodes in §7, checkpointed in Postgres. | A run survives a server restart or timeout and resumes from its last checkpoint. `thread_id` = run id. |
| P0-3 | **Evidence-backed signals.** | Every stored signal has a `source_url`, `source_date` and extracted quote. Signals without evidence are dropped, not stored. |
| P0-4 | **Truthful verification.** | `verified_current` is set only when the provider confirms the role AND the email is deliverable. Placeholder or guessed contacts are labelled and never counted as verified. |
| P0-5 | **Human-in-the-loop review.** | The run pauses at `humagentReview`. Only the assigned Humagent or the Admin can resume it. Cards reach the client only after approval. |
| P0-6 | **Idempotent persistence.** | Retrying or resuming a run creates no duplicate companies, contacts, signals or dossiers (upsert on workspace + domain / email). |
| P0-7 | **Stop, budget and time guards.** | A stop request halts the run within one node. Exceeding the run budget ends it with status `stopped` and a reason. A single invocation runs no longer than 300s and continues automatically. |
| P0-8 | **Tenant isolation.** | Every API route enforces session and workspace access. Anon-key DB access returns nothing (already done; regression-checked each release). |
| P0-9 | **Live progress.** | The UI shows the current node and step within 2s of it changing (existing SSE contract). |
| P0-10 | **DNC and dedupe.** | No delivered card matches a DNC domain or a previously delivered account for that workspace. |

### P1 — nice to have
- `IcpIntakeGraph`: build an ICP draft from the client's website and a short conversation.
- Per-run cost dashboard (tokens, API calls, cost per verified lead) from real usage events, replacing today's hardcoded telemetry.
- Challenge workflow with Admin resolution and credit adjustment.
- LangSmith tracing for graph runs.
- Brand-grade landing page with original 3D "signal graph" hero, plus redesigned portals.

### P2 — future
- `SignalMonitorGraph`: scheduled re-scan of delivered accounts for new signals.
- CRM export (HubSpot, Salesforce) and an outreach-sequence integration.
- Hashed credentials with a one-time reveal and password reset; SSO for client teams.
- Shared rate limiting and queueing (Redis or Upstash) and a durable job queue for long runs.

## 7. Agent system (LangGraph.js)
**Main graph `ProspectingGraph`:** `loadContext` → `planQueries` → `discoverCompanies` → `dedupeFilter` → fan-out (`Send`) to the `AccountPipeline` subgraph → `aggregate` → `humagentReview` (interrupt) → `publishToClient` → `finalize`. A `stopGuard` and a `budgetGuard` sit on the conditional edges between nodes.

**Subgraph `AccountPipeline`:** `extractSignals` → `scoreFit` → (if below threshold, `discard`) → `findContacts` → `verifyContacts` → `writeDossier` → `persistAccount`.

**Tools** wrap the existing adapters: Brave and Tavily search, Tavily extract, Apollo, Serper, ZeroBounce, Gemini and OpenAI.

## 8. Success metrics
| Metric | Type | Target | Measured from |
|---|---|---|---|
| Verified-lead rate (verified cards / researched companies) | Leading | ≥ 30% **[A]** | `research_runs` counts |
| Time from ICP approval to the first 5 cards published | Leading | ≤ 24h for 90% of clients | workspace and company timestamps |
| Cost per verified lead | Leading | ≤ $1.50 **[A]** | `usage_events` |
| Run failure rate | Leading | < 5% | run status |
| Upheld challenge rate | Lagging | < 10% of delivered cards | `audit_logs` challenges |
| Client retention after month 1 | Lagging | ≥ 70% **[A]** | workspace status |

Review these at 2 weeks and again at 1 month after the graph launches.

## 9. Open questions
| Question | Owner | Blocking? |
|---|---|---|
| What is the cost budget per run and per verified lead? | Founder | Yes, for P0-7 |
| What is the primary search provider (Brave vs Tavily vs Serper) and which keys are funded? | Founder | Yes, for P0-1/3 |
| Does the Supabase pooler URL support the LangGraph checkpointer, or is a direct connection needed? | Engineering | Yes, for P0-2 |
| What are the score thresholds for discarding (fit and intent)? | Founder + data | No |
| What data-retention and GDPR stance applies to stored contact PII? | Legal | No, but needed before EU clients |

## 10. Timeline and phasing
1. **Phase A (P0-1 … P0-10):** the LangGraph graph alongside the old runner behind a flag, then a parity check, then removal of the old runner.
2. **Phase B (P1):** brand and 3D landing page, cost dashboard, challenge workflow, ICP intake.
3. **Phase C (P2):** monitoring, CRM integrations, credential hardening.

Dependencies: provider API keys, `DATABASE_URL` for checkpoints, and the 21st.dev key for UI components (Phase B).
