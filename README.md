# RevGenIQ OS — Autonomous B2B Revenue Intelligence Engine

Production-ready, multi-tenant autonomous B2B revenue intelligence operating system. RevGenIQ OS orchestrates multi-agent research meshes (Scout, Analyst, Matcher, Verifier, and Writer) to discover evidence-backed target accounts, extract verified buying signals, map decision makers, verify email deliverability, and generate calibrated outreach copy with human-in-the-loop governance.

---

## 🌟 Core Architecture & Capabilities

### 1. 100% Live Database Architecture (Supabase PostgreSQL 15+)
- **Zero Mock Numbers or Fake Counts**: Every metric across the Command Center, Admin Console, and Prospecting Views is computed dynamically from real database records.
- **14 Production Tables with Row-Level Security (RLS)**:
  `workspaces`, `workspace_members`, `companies`, `contacts`, `research_runs`, `research_tasks`, `signals`, `dossiers`, `outreach_drafts`, `approvals`, `integration_connections`, `usage_events`, `audit_logs`, `icp_profiles`.
- **Tenant Isolation**: Database policies strictly enforce workspace membership checks (`app_security.is_workspace_member(workspace_id)`) preventing cross-tenant leakage.

### 2. Live Streaming ICP Search & Telemetry (Server-Sent Events)
- **Real-Time Execution Streaming** (`/api/runs/[id]/stream`):
  Streams live agent execution progress, active step logs, and discovered account records in real-time without client polling.
- **Multi-Agent Orchestration Mesh**:
  1. **Scout Agent**: Autonomous web discovery via Tavily AI and Serper Google Search.
  2. **Analyst Agent**: Deep LLM reasoning (OpenAI GPT-4o & Google Gemini 2.0) extracting confirmed corporate buying signals.
  3. **Matcher Agent**: B2B decision-maker graph mapping via Apollo.io API.
  4. **Verifier Agent**: Real-time SMTP handshake and MX check via ZeroBounce.
  5. **Writer Agent**: Dynamic outreach generation with tailored openers citing discovered buying signals.

### 3. Super Admin Operating Dashboard (`/admin`)
- **Direct Admin Authorization**: Authenticates via `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` or session cookie.
- **Tenant Directory**: Complete workspace inspection with real search counts, leads extracted, and credit quotas.
- **Global Search Run Inspector**: Drill down into any tenant's research runs to inspect individual agent tasks, queries, token counts, and discovered accounts.
- **MCP Provider Telemetry & Credits**: Real-time token usage, API call counters, and cost attribution across all LLM and data providers.
- **Security Audit Logs**: Live stream of system actions, tenant isolation checks, and export events.

### 4. Enterprise Security & Hardening
- **Company Email & Domain Validation**: Strict onboarding filters rejecting consumer email providers (`@gmail.com`, `@yahoo.com`, etc.) and enforcing valid corporate domains.
- **SQL & PostgREST Injection Defense**: Input sanitization escaping ILIKE wildcard patterns and PostgREST operator syntax.
- **SSRF Defense**: Strict URL validation blocking RFC 1918 private subnets, loopback interfaces, and cloud metadata IPs (`169.254.169.254`).
- **CSRF & Origin Protection**: Host and origin verification on all state mutation endpoints.
- **Sliding-Window Rate Limiting**: Built-in in-memory rate limiting across authentication, search, and export routes.
- **Zero Source Map Exposure**: Source maps disabled in production builds to prevent source leakage.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: `20.x` or `24.x` (tested on Node v24.20.0)
- **Supabase**: PostgreSQL 15+ instance with transaction pooler
- **API Keys**: OpenAI, Google Gemini, Tavily, Apollo, ZeroBounce

### 2. Installation
```bash
git clone <repo-url>
cd "RevGen B2Bos"
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Configure your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD="change_me_to_a_long_random_password"
ADMIN_SECRET_KEY=CHANGE_ME_openssl_rand_hex_32
JWT_SECRET=CHANGE_ME_openssl_rand_hex_32

OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
APOLLO_API_KEY=...
ZEROBOUNCE_API_KEY=...
```

### 4. Database Schema Migration
Run the production migration script in your Supabase SQL editor:
`supabase/migrations/20261016_full_production_schema.sql`

### 5. Start Development Server
```bash
npm run dev
```
Visit `http://localhost:3000` for the application, or `http://localhost:3000/admin` for the Super Admin console.

### 6. Verify Production Build
```bash
npm run build
```

---

## ☁️ Vercel Deployment

For detailed, step-by-step instructions on deploying RevGenIQ OS to Vercel with environment variable configuration, custom domains, and edge timeout optimization, see [DEPLOYMENT.md](file:///c:/Users/Mohit/Documents/RevGen%20B2Bos/DEPLOYMENT.md).

---

## 🧪 Postman API Testing Collection

A complete, battle-tested Postman collection is included in the project root:
- [`RevGenIQ_OS_Postman_Collection.json`](file:///c:/Users/Mohit/Documents/RevGen%20B2Bos/RevGenIQ_OS_Postman_Collection.json)

Covers:
1. **Authentication & Session**: Admin login, company signup, session check (`/api/auth/me`), logout.
2. **Super Admin Telemetry**: Overview KPIs, tenant users, global runs inspector, MCP credit counters.
3. **Autonomous Prospecting Engine**: Trigger research runs, SSE stream (`/api/runs/[id]/stream`), run details.
4. **Data Management**: Companies query, contacts directory, buying signals feed, account dossiers.
5. **Human Governance & Export**: Pending approvals queue, CSV export, formula-safe CSV import.
6. **Direct External Provider Checks**: OpenAI, Gemini, Tavily, Apollo, ZeroBounce health validations.

---

## 🛡️ License & Architecture Ownership
Enterprise Proprietary — RevGenIQ OS Architecture. All rights reserved.
