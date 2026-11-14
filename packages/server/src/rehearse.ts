import { Database } from "bun:sqlite";
import { join } from "node:path";
import { checkMigration, type MigrationReport, Tracker, takeInventory } from "@octotrack/core";
import { openSqlite } from "./sqlite.ts";

/**
 * Copies a live database into `workDir` and migrates the copy, never touching the original. The copy is made with
 * VACUUM INTO from a read-only connection, which takes in writes still sitting in the WAL; copying the file alone
 * would lose them. Returns the copy's path and what the migration kept or lost.
 */
export function rehearseCopy(source: string, workDir: string): { copy: string; report: MigrationReport } {
  const copy = join(workDir, "octo.db");
  const original = new Database(source, { readonly: true });
  try {
    original.query("VACUUM INTO ?").run(copy);
  } finally {
    original.close();
  }
  const driver = openSqlite(copy);
  const before = takeInventory(driver);
  const tracker = new Tracker(driver);
  return { copy, report: checkMigration(before, driver, tracker) };
}
