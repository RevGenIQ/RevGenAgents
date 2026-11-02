/**
 * findContacts (Matcher) and verifyContacts (Verifier).
 * Reuses enrichDecisionMaker and verifyEmailAddress through AgentTools.
 * A contact is verified only when a provider confirmed the role AND the email
 * is deliverable (P0-4); placeholders never reach this point.
 */

import type { AgentDeps } from "../../deps";
import type { AccountStateType, AccountUpdate } from "../../state";
import type { UsageEntry, VerifiedContact } from "../../types";
import { finishTask, startTask } from "../guards";

export function createFindContacts(deps: AgentDeps) {
  return async function findContacts(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context } = state;
    const taskId = await startTask(deps, {
      runId: context.runId,
      workspaceId: context.workspaceId,
      taskType: "Matcher",
      companyName: candidate.name,
      companyDomain: candidate.domain,
      output: { personas: context.personas },
    });

    const result = await deps.tools.findContact(candidate.name, candidate.domain, context.personas);
    const contacts = result.ok && result.value ? [result.value] : [];

    await finishTask(deps, taskId, result.ok ? "completed" : "failed", {
      contactsFound: contacts.length,
      contactMatched: contacts[0] ? `${contacts[0].firstName} ${contacts[0].lastName}`.trim() : null,
      title: contacts[0]?.title ?? null,
      ...(result.ok ? {} : { error: result.error.code }),
    });
    return { contacts, usage: result.usage };
  };
}

export function createVerifyContacts(deps: AgentDeps) {
  return async function verifyContacts(state: AccountStateType): Promise<AccountUpdate> {
    const { candidate, context, contacts } = state;
    if (contacts.length === 0) return { verified: [] };

    const taskId = await startTask(deps, {
      runId: context.runId,
      workspaceId: context.workspaceId,
      taskType: "Verifier",
      companyName: candidate.name,
      companyDomain: candidate.domain,
      output: { contacts: contacts.length },
    });

    const usage: UsageEntry[] = [];
    const verified: VerifiedContact[] = [];
    for (const contact of contacts) {
      const check = await deps.tools.verifyEmail(contact.workEmail);
      usage.push(...check.usage);
      const emailStatus = check.ok ? check.value.status : "unverified";
      const isVerified = contact.roleConfirmed && emailStatus === "deliverable";
      const reason = !contact.roleConfirmed
        ? "Role not confirmed by a provider."
        : emailStatus !== "deliverable"
        ? `Email ${emailStatus}${check.ok ? `: ${check.value.reason}` : ""}.`
        : "Role confirmed by provider and email deliverable.";
      verified.push({ ...contact, emailStatus, verified: isVerified, verificationReason: reason });
    }

    await finishTask(deps, taskId, "completed", {
      verifiedContacts: verified.filter((c) => c.verified).length,
      results: verified.map((c) => ({ emailStatus: c.emailStatus, roleConfirmed: c.roleConfirmed, verified: c.verified })),
    });
    return { verified, usage };
  };
}
