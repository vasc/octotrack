import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSessionFolder, wakeClaude } from "../src/adapters/claude.ts";

const SESSION = "1a6b1bbd-1a08-4241-ad67-70c2dd453982";
const dirs: string[] = [];

function projectsWith(lines: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "octo-claude-"));
  dirs.push(dir);
  mkdirSync(join(dir, "-Users-someone-projs-thing"));
  writeFileSync(join(dir, "-Users-someone-projs-thing", `${SESSION}.jsonl`), lines.join("\n"));
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("the Claude Code wake adapter", () => {
  test("finds the folder the session ran in, from its transcript", () => {
    const projects = projectsWith([
      '{"type":"summary"}',
      '{"cwd":"/Users/someone/projs/thing","type":"user"}',
    ]);
    expect(findSessionFolder(projects, SESSION)).toBe("/Users/someone/projs/thing");
  });

  test("skips a line still being written", () => {
    const projects = projectsWith(['{"cwd":', '{"cwd":"/Users/someone/projs/thing"}']);
    expect(findSessionFolder(projects, SESSION)).toBe("/Users/someone/projs/thing");
  });

  test("knows no session it has no transcript for", () => {
    expect(findSessionFolder(projectsWith([]), "not-a-session")).toBeNull();
  });

  test.each(["../../etc/passwd", "-x", ""])("will not look outside the transcripts for %j", (id) => {
    expect(findSessionFolder(projectsWith(['{"cwd":"/x"}']), id)).toBeNull();
  });

  test("resumes it there with the message, and passes the exit code on", async () => {
    const projects = projectsWith(['{"cwd":"/tmp"}']);
    const script = join(projects, "fake-claude");
    const record = join(projects, "argv");
    writeFileSync(script, `#!/bin/sh\nprintf '%s\\n' "$PWD" "$@" > "${record}"\nexit 3\n`, { mode: 0o755 });
    const code = await wakeClaude([SESSION, "D-1 has been answered"], {
      projectsDir: projects,
      claude: script,
    });
    expect(code).toBe(3);
    const lines = (await Bun.file(record).text()).trim().split("\n");
    expect(lines.slice(1)).toEqual(["-p", "--resume", SESSION, "D-1 has been answered"]);
    expect(lines[0]).toMatch(/\/tmp$/);
  });

  test("fails clearly when the session is not on this machine", async () => {
    expect(await wakeClaude([SESSION, "x"], { projectsDir: projectsWith([]) })).toBe(2);
  });
});
