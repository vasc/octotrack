import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqlite } from "../src/sqlite.ts";

function pragma(driver: ReturnType<typeof openSqlite>, name: string): unknown {
  const [row] = driver.all(`PRAGMA ${name}`);
  return row === undefined || row === null ? undefined : Object.values(row)[0];
}

/*
 * The machine restarting must not take back a write the tracker already answered as done. On 15 November a restart lost
 * a quarter of an hour of agents' writes: in WAL mode with synchronous NORMAL a commit is not flushed, and on macOS a
 * plain fsync leaves it in the drive's cache. Every commit is flushed to the disk itself.
 */
describe("the database keeps every write it acknowledged", () => {
  const driver = openSqlite(join(mkdtempSync(join(tmpdir(), "octo-sqlite-")), "octo.db"));

  test("each commit is synced, not left for a later checkpoint", () => {
    // 2 is FULL.
    expect(pragma(driver, "synchronous")).toBe(2);
  });

  test("a sync reaches the disk, not only the drive's cache", () => {
    expect(pragma(driver, "fullfsync")).toBe(1);
    expect(pragma(driver, "checkpoint_fullfsync")).toBe(1);
  });
});
