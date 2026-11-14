import { z } from "zod";
import { contracts } from "../contracts.ts";
import type { Tracker } from "../tracker.ts";
import type { SqlDriver } from "./driver.ts";

/**
 * What a database holds that a migration must keep: every ref that resolves today, and the counts and counters that
 * must not shrink. Taken from the old database with plain SQL before a migration, then checked against the migrated
 * one through the tracker, so a rehearsal on a copy of the real data shows exactly what would be lost.
 */
export interface Inventory {
  refs: string[];
  events: number;
  links: number;
  agents: number;
  counters: Record<string, number>;
  openDriftByRule: Record<string, number>;
}

export interface MigrationReport {
  problems: string[];
  before: Inventory;
  after: Omit<Inventory, "refs">;
}

/** Tables whose rows are items a user can name by ref. Read only when present, so this works on any version. */
const REF_TABLES = [
  "projects",
  "repos",
  "issues",
  "decisions",
  "milestones",
  "ideas",
  "updates",
  "prs",
  "drifts",
];

const Ref = z.array(z.object({ ref: z.string() }));
const Count = z.array(z.object({ count: z.number() }));
const Counter = z.array(z.object({ name: z.string(), value: z.number() }));
const RuleCount = z.array(z.object({ rule: z.string(), count: z.number() }));
const Name = z.array(z.object({ name: z.string() }));

function tables(driver: SqlDriver): Set<string> {
  return new Set(
    Name.parse(driver.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map((row) => row.name),
  );
}

function count(driver: SqlDriver, table: string, present: Set<string>): number {
  if (!present.has(table)) return 0;
  return Count.parse(driver.all(`SELECT COUNT(*) AS count FROM ${table}`))[0]?.count ?? 0;
}

function totals(driver: SqlDriver): Omit<Inventory, "refs"> {
  const present = tables(driver);
  const counters = present.has("counters")
    ? Object.fromEntries(
        Counter.parse(driver.all("SELECT name, value FROM counters")).map((row) => [row.name, row.value]),
      )
    : {};
  const openDriftByRule = present.has("drifts")
    ? Object.fromEntries(
        RuleCount.parse(
          driver.all(
            "SELECT rule, COUNT(*) AS count FROM drifts WHERE status = 'open' GROUP BY rule ORDER BY rule",
          ),
        ).map((row) => [row.rule, row.count]),
      )
    : {};
  return {
    events: count(driver, "events", present),
    links: count(driver, "links", present),
    agents: count(driver, "agents", present),
    counters,
    openDriftByRule,
  };
}

export function takeInventory(driver: SqlDriver): Inventory {
  const present = tables(driver);
  const refs = REF_TABLES.filter((table) => present.has(table)).flatMap((table) =>
    Ref.parse(driver.all(`SELECT ref FROM ${table} ORDER BY ref`)).map((row) => row.ref),
  );
  return { refs, ...totals(driver) };
}

/** Compares the migrated database with what it held before. Drift by rule is reported for reading, not judged. */
export function checkMigration(before: Inventory, driver: SqlDriver, tracker: Tracker): MigrationReport {
  const problems: string[] = [];
  for (const ref of before.refs) {
    try {
      tracker.call(contracts.entityShow, { ref }, { actor: "octotrack", channel: "cli" });
    } catch {
      problems.push(`${ref} no longer resolves`);
    }
  }
  const after = totals(driver);
  const shrank = (what: "events" | "links" | "agents") => {
    if (after[what] < before[what]) problems.push(`${what} went from ${before[what]} to ${after[what]}`);
  };
  shrank("events");
  shrank("links");
  shrank("agents");
  for (const [name, value] of Object.entries(before.counters)) {
    const now = after.counters[name];
    if (now === undefined) problems.push(`counter ${name} went from ${value} to nothing`);
    else if (now < value) problems.push(`counter ${name} went from ${value} to ${now}`);
  }
  return { problems, before, after };
}
