import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The wake adapter for Claude Code: `bun claude.ts <session-id> <message>`. Claude Code only resumes a session from the folder
 * it ran in, and the server runs from somewhere else, so this finds that folder from the session's transcript first. Nothing
 * here is known to the tracker, which only sees `claude:<session-id>`. See docs/DESIGN.md, D12.
 */

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function findSessionFolder(projectsDir: string, sessionId: string): string | null {
  if (!SESSION_ID.test(sessionId) || !existsSync(projectsDir)) return null;
  for (const project of readdirSync(projectsDir)) {
    const transcript = join(projectsDir, project, `${sessionId}.jsonl`);
    if (!existsSync(transcript)) continue;
    for (const line of readFileSync(transcript, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      try {
        const entry: unknown = JSON.parse(line);
        if (typeof entry === "object" && entry !== null && "cwd" in entry && typeof entry.cwd === "string") {
          return entry.cwd;
        }
      } catch {
        // A line still being written. The next one will do.
      }
    }
  }
  return null;
}

export async function wakeClaude(
  args: readonly string[],
  options: { projectsDir?: string; claude?: string } = {},
): Promise<number> {
  const [sessionId, message] = args;
  if (sessionId === undefined || message === undefined) {
    console.error("Usage: claude.ts <session-id> <message>");
    return 2;
  }
  const folder = findSessionFolder(options.projectsDir ?? join(homedir(), ".claude", "projects"), sessionId);
  if (folder === null) {
    console.error(`No Claude Code session ${sessionId} on this machine`);
    return 2;
  }
  const claude = options.claude ?? Bun.which("claude") ?? join(homedir(), ".local", "bin", "claude");
  const child = Bun.spawn([claude, "-p", "--resume", sessionId, message], {
    cwd: folder,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const [code, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  // Claude Code prints its own failures, such as an expired login, as output. The server keeps only errors.
  if (code !== 0) console.error(output.trim().slice(-OUTPUT_KEPT));
  return code;
}

const OUTPUT_KEPT = 300;

if (import.meta.main) process.exit(await wakeClaude(process.argv.slice(2)));
