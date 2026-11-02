// PostToolUse(Edit|Write), async: type-check after a src/**/*.ts(x) edit.
// Exit code 2 (with errors on stderr) wakes Claude; a clean check stays silent.
import { spawnSync } from "node:child_process";

const MAX_LINES = 25;

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
const filePath = String(input?.tool_input?.file_path || input?.tool_response?.filePath || "").replace(/\\/g, "/");

if (!/\/src\/.+\.tsx?$/.test(filePath)) {
  process.exit(0);
}

const result = spawnSync("npx tsc --noEmit -p .", {
  cwd: input.cwd || process.cwd(),
  encoding: "utf8",
  shell: true,
});

if (result.status !== 0) {
  const errors = `${result.stdout || ""}${result.stderr || ""}`.trim().split("\n");
  const shown = errors.slice(0, MAX_LINES).join("\n");
  const more = errors.length > MAX_LINES ? `\n…and ${errors.length - MAX_LINES} more lines` : "";
  process.stderr.write(`TypeScript errors after editing ${filePath}:\n${shown}${more}\n`);
  process.exit(2);
}
