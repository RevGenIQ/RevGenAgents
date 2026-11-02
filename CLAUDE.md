# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

RevGen IQ: an AI B2B lead-generation and prospecting service. A client submits an ICP brief, the Admin and an assigned human reviewer (a "Humagent") prepare verified account cards, and the client reviews them. Stack: Next.js 16 (App Router) + React 19 + Tailwind v4 + Supabase (Postgres).

Read `AGENTS.md` first: this Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before using a Next API you have not verified (e.g. `after()`, route segment config).

## Commands

```bash
npm run dev          # dev server on http://localhost:3000
npm run build        # production build (uses --webpack, not Turbopack)
npm run lint         # eslint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit -p . # type check
npm run preflight    # scripts/preflight.ts: env and Supabase connectivity checks
npm run import:hdl / import:extrieve     # load client .xlsx datasets from data/ into Supabase
npm run unimport:hdl / unimport:extrieve # remove those imports
```

`npm test` runs vitest (`src/**/*.test.ts`); one file: `npx vitest run src/lib/llm/__tests__/router.test.ts`. `npm run build` stops with `SecurityFatalError` if the installed `next` has a known advisory: upgrade `next` and `eslint-config-next` together (pinned exact versions).

## Git

Commit on the `Development` branch, never directly on `main`. Commit messages use `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci).

## Architecture

### Three portals, one role-scoped state API
- `/` → `src/app/page.tsx`: landing page when logged out; otherwise the client app, a single page that switches modules by state (not by URL) between `src/components/modules/*` (CommandCenter, IcpGrowthInputs, AgentMesh, AccountsContacts, WorkspaceChannelHub, AccountDossierDrawer).
- `/admin` (`src/app/admin/page.tsx`) and `/human-agent` are the staff portals. Redirects between portals happen client-side only; there is no `middleware.ts`/`proxy.ts`, so **every API route enforces its own auth**.
- Nearly all UI data flows through **`/api/os/workflow`**: GET returns workspaces, accounts, messages, ICPs, humagents and access requests already filtered for the caller's role; POST is an `action`-dispatched mutation endpoint (approve/create clients, create/allocate humagents, chat messages, `submit_icp`, `create_prospect_account`, `update_account`). The browser caches the result in the module-level store `src/lib/store/osWorkflowStore.ts` (optimistic update, then re-sync).
- The browser Supabase client (`src/lib/supabase/client.ts`) is unused. All DB access is server-side via `createServerClient()` with the **service-role key** (bypasses RLS). RLS is deliberately locked down so the anon key can read nothing.

### Auth (`src/lib/security/auth.ts`)
- Custom HMAC-signed token in the HttpOnly `revgeniq_session` cookie (not Supabase Auth). Admin tokens are signed with `ADMIN_SECRET_KEY`, all others with `JWT_SECRET`; both must be ≥32 chars or signing fails closed.
- Roles: `admin` (from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env), `humagent` (rows in `humagent_users`), `client` (approved rows in `workspaces`, login by generated login ID / primary email / registered spokesperson email). Admin and humagent sessions carry placeholder non-UUID `workspaceId`s.
- Use `verifyWorkspaceAccess(session, workspaceId)` for tenant scoping: it denies unauthenticated callers, requires admins to pass a real workspace UUID, and locks others to their own workspace. In `os/workflow`, use `canAccessWorkspace()` (humagents are allowed on allocated workspaces).
- Mutating routes call `verifyCsrfAndOrigin` (`cors.ts`) and `rateLimit` (`rateLimit.ts`, in-memory per instance).

### Research pipeline
`POST /api/runs` inserts a `research_runs` row and runs `executeResearchRun` (`src/lib/engine/researchRunner.ts`) inside `after()` (route `maxDuration = 300`). The runner chains adapters in `src/lib/adapters/`: discovery (`research.ts`: Brave → Tavily, then Gemini/OpenAI analysis) → contact enrichment (`enrichment.ts`: Apollo → Serper LinkedIn → labelled placeholder) → email verification (`verification.ts`: ZeroBounce) → opener (`llm.ts`). Progress is written to `research_runs`/`research_tasks` and polled by the SSE route `/api/runs/[id]/stream`. Discovery prompts and queries are currently hardcoded for one seller (HTL/HFCL).

### Database
Migrations live in `supabase/migrations/` (`_old_migrations/` is a stale copy). `20261016_full_production_schema.sql` defines the 14 core tables; `20261031_phase1_revgeniq_os_schema.sql` adds `client_access_requests`, `humagent_users`, `workspace_messages` and many workspace/company columns; `20261102_security_lockdown.sql` removes public access. `20261014_revgeniq_core_schema.sql` references tables and an `app_security` function that do not exist at that point, so it fails on an empty database. Login passwords are stored in plaintext (`workspaces.generated_password`, `humagent_users.password_plain`) and shown to the admin only.

### Styling
Tailwind v4 via `@tailwindcss/postcss`. `dark:` utilities follow the `.dark` class set on `<html>` by `ThemeToggle` and the inline script in `layout.tsx` (`@custom-variant dark` in `globals.css`).

## Environment
Copy `.env.example` to `.env.local`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Optional provider keys enable each pipeline stage: `BRAVE_API_KEY`, `TAVILY_API_KEY`, `SERPER_API_KEY`, `APOLLO_API_KEY`, `ZEROBOUNCE_API_KEY`. LLM calls go through `src/lib/llm/` (`llmText` / `llmJson`): every provider with a key (OpenAI, Gemini, Anthropic, Groq, xAI, DeepSeek, Mistral, OpenRouter, Together, or any OpenAI-compatible API via `LLM_<NAME>_BASE_URL/_API_KEY/_MODEL`) joins a fallback chain ordered by `LLM_PROVIDER_ORDER`; never call a provider API directly. `ALLOWED_ORIGINS` adds extra origins to the CSRF allow-list. `data/` (client spreadsheets) and `.env*` are gitignored.
