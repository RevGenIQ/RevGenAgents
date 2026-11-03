import { describe, expect, it } from "vitest";
import type { WorkspaceChatMessage } from "@/lib/store/osWorkflowStore";
import { buildThread, dayLabel, initials, isOwnMessage } from "../chatFormat";

const NOW = new Date(2026, 10, 3, 15, 0);

function msg(id: string, role: WorkspaceChatMessage["senderRole"], at: Date, email = `${role}@x.com`): WorkspaceChatMessage {
  return { id, workspaceId: "w", senderRole: role, senderName: role, senderEmail: email, messageType: "text", content: id, createdAt: at.toISOString() };
}

describe("chat formatting", () => {
  it("labels days relative to now", () => {
    expect(dayLabel(new Date(2026, 10, 3, 9).toISOString(), NOW)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 2, 23).toISOString(), NOW)).toBe("Yesterday");
  });

  it("adds a day separator per day and groups a sender's consecutive messages", () => {
    const thread = buildThread(
      [
        msg("a", "client", new Date(2026, 10, 2, 10, 0)),
        msg("b", "client", new Date(2026, 10, 3, 10, 0)),
        msg("c", "client", new Date(2026, 10, 3, 10, 2)),
        msg("d", "admin", new Date(2026, 10, 3, 10, 3)),
        msg("e", "admin", new Date(2026, 10, 3, 10, 30)),
      ],
      NOW
    );
    expect(thread.filter((t) => t.kind === "day").map((t) => t.label)).toEqual(["Yesterday", "Today"]);
    const m = Object.fromEntries(thread.filter((t) => t.kind === "message").map((t) => [t.key, [t.startsGroup, t.endsGroup]]));
    expect(m).toEqual({ a: [true, true], b: [true, false], c: [false, true], d: [true, true], e: [true, true] });
  });

  it("never groups system messages", () => {
    const thread = buildThread([msg("s1", "system", new Date(2026, 10, 3, 10)), msg("s2", "system", new Date(2026, 10, 3, 10, 1))], NOW);
    expect(thread.filter((t) => t.kind === "message").every((t) => t.startsGroup && t.endsGroup)).toBe(true);
  });

  it("recognises the viewer's own messages by role and email", () => {
    const m = msg("x", "admin", NOW, "Boss@x.com");
    expect(isOwnMessage(m, "admin", "boss@x.com")).toBe(true);
    expect(isOwnMessage(m, "admin", "other@x.com")).toBe(false);
    expect(isOwnMessage(m, "client", "boss@x.com")).toBe(false);
  });

  it("makes initials", () => {
    expect(initials("Priya Sharma")).toBe("PS");
    expect(initials("admin")).toBe("A");
  });
});
