---
name: revgen-route-audit
description: Audit RevGen IQ API routes (src/app/api/**/route.ts) for the repo's security contract — session checks, tenant scoping, CSRF, rate limits, input validation, checked DB writes, no credential leaks. Use after adding or changing an API route, before a release, or when asked to "audit the API", "check route security" or "security review".
---

# RevGen IQ API route audit

There is no middleware: **every route enforces its own security.** For each `route.ts` in scope (the changed routes, or all of `src/app/api/**` for a full audit), check each item and record pass or fail with `file:line`.

## Checklist
1. **Session.** Non-public routes call `getSessionFromRequest(request)` and return 401 when it is null — *before* looking up records by ID, so 404 vs 401 does not reveal which IDs exist. Public by design: `auth/login`, `auth/signup`, `public-intent`.
2. **Tenant scope.**
   - Workspace-bound reads and writes go through `verifyWorkspaceAccess(session, workspaceId)` (src/lib/security/auth.ts).
   - In `os/workflow`, use `canAccessWorkspace()`: humagents only on allocated workspaces.
   - For records fetched by ID, check the record's own `workspace_id`, not a client-supplied one.
   - Updates and deletes also filter by `workspace_id` in the query.
3. **Role.** Admin-only actions check `session.role === "admin"`. Clients cannot change staff-only fields (contacts, delivery stage).
4. **CSRF.** Every POST/PUT/PATCH/DELETE calls `verifyCsrfAndOrigin(request)` first.
5. **Rate limit.** Mutations and expensive or public endpoints call `rateLimit(request, { max, windowMs, prefix })` with a unique prefix. Login and signup must be tight.
6. **Input.**
   - Validate types and lengths.
   - Pass IDs through `isValidUUID`.
   - Run free text through `sanitizeHtml`.
   - Allow-list enums (statuses, message types).
   - URLs from users must be http(s).
7. **Writes are checked.** Every Supabase insert/update/delete checks `error`, and the route does not report success when the write failed. `audit_logs` inserts use the real columns (`workspace_id` UUID NOT NULL, `actor_email`, `action`, `target_type` NOT NULL, `target_id`, `details`).
8. **No leaks.**
   - Responses never include `generated_password` or `password_plain` except to an admin.
   - 5xx responses go through `apiError` (which hides details in production).
   - No secrets in code; env vars fail closed (no fallback secrets).
9. **Long work.** Background work uses `after()` from `next/server` with `export const maxDuration`. Never use a detached promise (it is frozen on serverless).
10. **Truthfulness.** Nothing reports fabricated data as real or verified (placeholder contacts, invented credits or telemetry).

## Output
A table: route, then failing items with `file:line`, severity (CRITICAL/HIGH/MEDIUM/LOW) and the concrete fix. Verify each finding by reading the code; do not report from pattern matches alone. Offer to fix the CRITICAL and HIGH items.
