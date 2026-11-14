import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { type Migration, migrate, SCHEMA_VERSION } from "../src/db/migrations.ts";
import { checkMigration, takeInventory } from "../src/db/rehearsal.ts";
import { Tracker } from "../src/tracker.ts";
import { buildVersion4 } from "./fixtures/version4.ts";
import { memoryDriver } from "./helpers.ts";

const UserVersion = z.object({ user_version: z.number() });
const versionOf = (driver: ReturnType<typeof memoryDriver>) =>
  UserVersion.parse(driver.all("PRAGMA user_version")[0]).user_version;
const tableNames = (driver: ReturnType<typeof memoryDriver>) =>
  z
    .array(z.object({ name: z.string() }))
    .parse(driver.all("SELECT name FROM sqlite_master WHERE type = 'table'"))
    .map((row) => row.name);

describe("migrations", () => {
  test("can stop at a version, so a test can build the database as it was", () => {
    const driver = memoryDriver();
    migrate(driver, 2);
    expect(versionOf(driver)).toBe(2);
    const columns = z
      .array(z.object({ name: z.string() }))
      .parse(driver.all("PRAGMA table_info(decisions)"))
      .map((row) => row.name);
    expect(columns.includes("postponedAt")).toBe(false);
  });

  test("runs to the latest version by default", () => {
    const driver = memoryDriver();
    migrate(driver);
    expect(versionOf(driver)).toBe(SCHEMA_VERSION);
  });

  test("a migration can be code as well as SQL, and runs in its version's transaction", () => {
    const driver = memoryDriver();
    const seen: number[] = [];
    const steps: readonly Migration[] = [
      "CREATE TABLE things (name TEXT PRIMARY KEY)",
      (sql) => {
        sql.run("INSERT INTO things (name) VALUES ('made by code')");
        seen.push(1);
      },
    ];
    migrate(driver, undefined, steps);
    expect(versionOf(driver)).toBe(2);
    expect(seen).toEqual([1]);
    expect(driver.all("SELECT name FROM things")).toEqual([{ name: "made by code" }]);
  });

  test("a failing step leaves the database at the version before it", () => {
    const driver = memoryDriver();
    const steps: readonly Migration[] = [
      "CREATE TABLE things (name TEXT PRIMARY KEY)",
      (sql) => {
        sql.run("INSERT INTO things (name) VALUES ('half done')");
        throw new Error("broken step");
      },
    ];
    expect(() => migrate(driver, undefined, steps)).toThrow("broken step");
    expect(versionOf(driver)).toBe(1);
    expect(driver.all("SELECT name FROM things")).toEqual([]);
  });
});

describe("rehearsing a migration", () => {
  test("the version-4 fixture opens in today's tracker with every ref, event and counter intact", () => {
    const driver = memoryDriver();
    buildVersion4(driver);
    const before = takeInventory(driver);
    expect(before.refs.length).toBeGreaterThan(15);
    const tracker = new Tracker(driver, () => "2026-11-14T12:00:00.000Z");
    const report = checkMigration(before, driver, tracker);
    expect(report.problems).toEqual([]);
    expect(report.after.events).toBe(before.events);
  });

  test("a ref the migration lost is reported, not hidden", () => {
    const driver = memoryDriver();
    buildVersion4(driver);
    const before = takeInventory(driver);
    const tracker = new Tracker(driver, () => "2026-11-14T12:00:00.000Z");
    driver.run("DELETE FROM updates WHERE ref = 'U-2'");
    driver.run("DELETE FROM counters WHERE name = 'idea'");
    const report = checkMigration(before, driver, tracker);
    expect(report.problems).toContain("U-2 no longer resolves");
    expect(report.problems).toContain("counter idea went from 3 to nothing");
  });

  test("lists the tables the fixture filled, so a new table in version 4 cannot be missed", () => {
    const driver = memoryDriver();
    buildVersion4(driver);
    expect(tableNames(driver).sort()).toEqual(
      [
        "agents",
        "counters",
        "decisions",
        "drifts",
        "events",
        "github_sync",
        "ideas",
        "issues",
        "link_tombstones",
        "links",
        "milestones",
        "prs",
        "projects",
        "sqlite_sequence",
        "updates",
        "views",
        "watches",
      ].sort(),
    );
  });
});
