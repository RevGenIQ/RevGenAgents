// PreToolUse(Bash): refuse `git commit` unless the current branch is Development.
import { execSync } from "node:child_process";

const REQUIRED_BRANCH = "Development";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

let input = {};
try {
  input = JSON.parse((await readStdin()) || "{}");
} catch {
  process.exit(0);
}
const command = String(input?.tool_input?.command || "");

if (!/\bgit\b(?:\s+-\S+(?:\s+\S+)?)*\s+commit\b/.test(command)) {
  process.exit(0);
}

let branch = "";
try {
  branch = execSync("git branch --show-current", {
    cwd: input.cwd || process.cwd(),
    encoding: "utf8",
  }).trim();
} catch {
  process.exit(0);
}

if (branch !== REQUIRED_BRANCH) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Commits in this repo go on "${REQUIRED_BRANCH}" (current branch: "${branch || "detached"}"). Run: git switch ${REQUIRED_BRANCH}`,
      },
    })
  );
}
