# RevGenIQ OS — Security & Vulnerability Remediation Architecture

This document outlines the defensive security architecture, audit findings, and hardening measures implemented across **RevGenIQ OS**.

---

## 1. Vulnerability Scan & Remediation Matrix

| Category | Vulnerability / Threat | Remediation Implemented | Source Verification |
| :--- | :--- | :--- | :--- |
| **Authentication & Tokens** | LocalStorage Token Theft (XSS Risk) | Removed client-side JWT persistence from `localStorage`. Sessions are stored in **Secure, HttpOnly, SameSite=Lax** cookies signed with HMAC-SHA256. | `src/lib/security/auth.ts`, `src/lib/supabase/client.ts` |
| **Secrets & Keys** | Hardcoded secrets in code & `.env.example` | Stripped all live keys and JWT tokens from `.env.example`. Removed hardcoded fallbacks from `client.ts` and `server.ts`. All secrets are isolated strictly on the server. | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `.env.example` |
| **SQL / PostgREST Injection** | Filter Grammar Injection in Search (`ilike.%${search}%`) | Parameter sanitization via `sanitizeSearchQuery()`: strips commas, parentheses, quotes, and PostgREST operator injection triggers before executing database queries. | `src/lib/security/validator.ts`, `src/app/api/contacts/route.ts` |
| **BOLA / IDOR** | Unauthenticated Workspace ID manipulation (`workspaceId` query tampering) | Server-side `verifyWorkspaceAccess(session, requestedWorkspaceId)`. Members can only access their authenticated tenant workspace; Super-Admins retain global audit visibility. | `src/lib/security/auth.ts`, `src/app/api/runs/route.ts` |
| **SSRF** | Server-Side Request Forgery via user-supplied URLs (Cloud Metadata / Loopback) | `validateSafeUrl()`: Validates URL protocol (`http:` / `https:`) and blocks loopback (`127.0.0.1`), RFC 1918 private subnets, and cloud metadata IPs (`169.254.169.254`). | `src/lib/security/ssrf.ts`, `src/app/api/icp/parse/route.ts` |
| **Rate Limiting / DoS** | Endpoint Brute-force & Resource Exhaustion | In-memory sliding-window token bucket (`rateLimit()`): limits auth attempts (5 req/min), search launches (15 req/min), and API reads (60-80 req/min). | `src/lib/security/rateLimit.ts` |
| **CSRF & CORS** | Cross-Origin Request Forgery on state-changing methods | `verifyCsrfAndOrigin()` verifies incoming `Origin` and `Host` headers on POST/PUT/DELETE/PATCH. Strict CORS policy configured. | `src/lib/security/cors.ts` |
| **CSV Formula Injection** | Excel command execution via `=cmd|` in exported leads | `sanitizeForCsv()` prepends single quotes to values starting with `=`, `+`, `-`, `@`, `\t`, `\r`. | `src/lib/security/validator.ts`, `src/app/api/export/route.ts` |
| **Information Leakage** | Production source maps & sensitive logging | Set `productionBrowserSourceMaps: false` in `next.config.ts`. Implemented `logger` utility with automatic masking for passwords, tokens, API keys, and cookie headers. | `next.config.ts`, `src/lib/security/logger.ts` |
| **Dependencies** | Vulnerable packages (`braces` / `micromatch` advisory) | Added npm `overrides` for `"braces": "^3.0.3"` and `"micromatch": "^4.0.8"`. | `package.json` |

---

## 2. Super-Admin Privileges & Access Credentials

Direct Super-Admin credentials are configured in `.env` and `.env.local`:

- **Admin Email**: `admin@revgeniq.os`
- **Admin Password**: `RevGen_Admin#Sec2026!Master`
- **Admin Direct Link**: [`/admin`](http://localhost:3000/admin)
- **Secret Key**: `revgeniq_super_secret_admin_key_2026_x89f_secure`

### Super Admin Privileges:
1. **Tenant Workspace Oversight**: Inspect all registered company domains and user accounts.
2. **Search Workflow Inspector**: Deep-dive into ANY individual user's search queries, agent execution logs, discovered companies, signals, and verified leads.
3. **MCP & Token Credits Telemetry**: Real-time tracking of token counts and estimated costs across all AI providers (OpenAI, Gemini, Anthropic, Tavily, Apollo, ZeroBounce).
4. **Security & Audit Feed**: Real-time stream of all authentication events, workspace modifications, and blocked security attacks.

---

## 3. Business Email & Domain Verification Rules

To maintain high data integrity and multi-tenant isolation:
- Personal / consumer email domains are blocked during sign in and sign up: `@gmail.com`, `@yahoo.com`, `@hotmail.com`, `@outlook.com`, `@icloud.com`, `@aol.com`, `@protonmail.com`, etc.
- Users must provide a valid **Company Domain** (e.g. `company.com`).
- The domain dictates tenant workspace isolation and cryptographic data separation.
