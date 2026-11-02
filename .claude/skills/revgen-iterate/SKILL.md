---
name: revgen-iterate
description: Close out one iteration of work in the RevGen IQ repo — verify (types, lint on changed files, tests, build), code-review the diff, then commit and push on the Development branch. Use when a change is finished and the user wants it committed/pushed, or says "next iteration", "ship it", "commit and push".
---

# RevGen IQ iteration close-out

Run these steps in order. Stop and report if a step fails; do not commit a failing tree.

1. **Branch.** `git branch --show-current` must print `Development`. If not, `git switch Development` (never commit on `main`).
2. **Scope.** `git status --short` and `git diff --stat`. Only stage files that belong to this iteration — another agent or session may have work in progress in the same tree. Never use `git stash` here: it would sweep up their changes too.
3. **Types.** `npx tsc --noEmit -p .` must pass.
4. **Lint the changed files only** (the repo has pre-existing lint debt): `npx eslint <changed src files>`. No new errors; compare against `git show HEAD:<file>` if unsure whether an error is new.
5. **Tests.** `npm test` (vitest). Skip only if no test files exist yet, and say so.
6. **Build.** `npm run build`. If it fails with `SecurityFatalError`, the pinned `next` has an advisory: upgrade `next` and `eslint-config-next` together to the patched version. If a dev server holds `.next`, report it rather than killing the user's server.
7. **Review.** Run `/code-review` on the diff. Fix CRITICAL and HIGH findings before committing; list MEDIUM ones for the user.
8. **Commit.** Conventional message `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci) with a short body of what changed and why. No attribution trailer (disabled for this user).
9. **Push.** `git push` (upstream `origin/Development` is already set). Report the commit hash.
10. **Refresh the code graph** if `graphify-out/` exists: run `graphify update .` (no API cost; the `graphify` CLI lives in the user's Python Scripts directory, which may not be on PATH).

Report: what was verified, what was skipped and why, the commit hash, and anything left for the user (keys to set, migrations to apply).
