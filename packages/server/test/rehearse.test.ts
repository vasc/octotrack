import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate, SCHEMA_VERSION } from "@octotrack/core";
import { rehearseCopy } from "../src/rehearse.ts";
import { openSqlite } from "../src/sqlite.ts";

const T = "2026-11-01T09:00:00.000Z";
const dirs: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "octo-rehearse-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function versionOf(path: string): number {
  const db = new Database(path, { readonly: true });
  try {
    const row = db.query("PRAGMA user_version").get();
    return typeof row === "object" &&
      row !== null &&
      "user_version" in row &&
      typeof row.user_version === "number"
      ? row.user_version
      : -1;
  } finally {
    db.close();
  }
}

describe("rehearsing a migration on a copy of the real database", () => {
  test("copies writes still in the WAL, migrates only the copy, and reports nothing lost", () => {
    const source = join(scratch(), "octo.db");
    const live = openSqlite(source);
    migrate(live, 4);
    live.run(
      `INSERT INTO projects (ref, name, description, status, repo, horizon, targetDate, version, createdAt, updatedAt, createdBy)
       VALUES ('PANEL', 'Home panel', '', 'active', 'acme/homepanel', 'now', NULL, 1, ?, ?, 'agent-a')`,
      [T, T],
    );
    live.run(
      `INSERT INTO issues (ref, project, title, body, status, priority, assignee, labels, milestone, version, createdAt, updatedAt, closedAt, createdBy)
       VALUES ('PANEL-6', 'PANEL', 'Measure the grip', '', 'blocked', 'medium', NULL, '[]', NULL, 1, ?, ?, NULL, 'agent-a')`,
      [T, T],
    );

    const work = scratch();
    const { copy, report } = rehearseCopy(source, work);

    expect(report.problems).toEqual([]);
    expect(report.before.refs).toEqual(["PANEL", "PANEL-6"]);
    expect(versionOf(copy)).toBe(SCHEMA_VERSION);
    expect(versionOf(source)).toBe(4);
  });
});
