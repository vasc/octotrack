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

  test("plan steps gain ids, and an issue on step 2 stays on step 2 by its id (version 26)", () => {
    const driver = memoryDriver();
    migrate(driver, 25);
    const at = "2026-11-17T12:00:00.000Z";
    driver.run(
      `INSERT INTO lines (ref, title, doneWhen, state, rank, source, version, createdAt, updatedAt, createdBy)
       VALUES ('L-1', 'Enclosure', 'It fits.', 'working', 1, 'developer', 1, ?, ?, 'dev')`,
      [at, at],
    );
    for (const [position, title] of [
      [1, "Model"],
      [2, "Print"],
      [3, "Fit"],
    ] as const) {
      driver.run("INSERT INTO plan_steps (line, position, title, status) VALUES ('L-1', ?, ?, 'todo')", [
        position,
        title,
      ]);
    }
    driver.run(
      `INSERT INTO projects (ref, name, description, status, horizon, version, createdAt, updatedAt, createdBy)
       VALUES ('OCT', 'Octotrack', '', 'active', 'now', 1, ?, ?, 'dev')`,
      [at, at],
    );
    driver.run(
      `INSERT INTO issues (ref, project, title, body, status, priority, labels, line, step, version, createdAt,
         updatedAt, createdBy)
       VALUES ('OCT-1', 'OCT', 'Print it', '', 'todo', 'none', '[]', 'L-1', 2, 1, ?, ?, 'dev')`,
      [at, at],
    );
    migrate(driver, 26);
    const steps = z
      .array(
        z.object({
          id: z.number(),
          position: z.number(),
          title: z.string(),
          branch: z.null(),
          ord: z.number(),
        }),
      )
      .parse(driver.all("SELECT id, position, title, branch, ord FROM plan_steps ORDER BY position"));
    expect(steps.map((step) => [step.position, step.title, step.ord])).toEqual([
      [1, "Model", 1],
      [2, "Print", 2],
      [3, "Fit", 3],
    ]);
    const issue = z
      .object({ step: z.number() })
      .parse(driver.all("SELECT step FROM issues WHERE ref = 'OCT-1'")[0]);
    expect(issue.step).toBe(steps[1]?.id ?? -1);
    expect(tableNames(driver)).toContain("plan_branches");
  });

  test("version 26: a step past the plan's end or on no line becomes none, and each line keeps its own steps", () => {
    const driver = memoryDriver();
    migrate(driver, 25);
    const at = "2026-11-17T12:00:00.000Z";
    for (const ref of ["L-1", "L-2"]) {
      driver.run(
        `INSERT INTO lines (ref, title, doneWhen, state, rank, source, version, createdAt, updatedAt, createdBy)
         VALUES (?, 'A line', 'Done.', 'working', 1, 'developer', 1, ?, ?, 'dev')`,
        [ref, at, at],
      );
      for (const position of [1, 2]) {
        driver.run("INSERT INTO plan_steps (line, position, title, status) VALUES (?, ?, ?, 'todo')", [
          ref,
          position,
          `${ref} step ${position}`,
        ]);
      }
    }
    driver.run(
      `INSERT INTO projects (ref, name, description, status, horizon, version, createdAt, updatedAt, createdBy)
       VALUES ('OCT', 'Octotrack', '', 'active', 'now', 1, ?, ?, 'dev')`,
      [at, at],
    );
    const issue = (ref: string, line: string | null, step: number) =>
      driver.run(
        `INSERT INTO issues (ref, project, title, body, status, priority, labels, line, step, version, createdAt,
           updatedAt, createdBy)
         VALUES (?, 'OCT', 'Work', '', 'todo', 'none', '[]', ?, ?, 1, ?, ?, 'dev')`,
        [ref, line, step, at, at],
      );
    issue("OCT-1", "L-2", 2);
    issue("OCT-2", "L-1", 5);
    issue("OCT-3", null, 1);
    migrate(driver, 26);
    const stepOf = (ref: string) =>
      z
        .object({ step: z.number().nullable() })
        .parse(driver.all("SELECT step FROM issues WHERE ref = ?", [ref])[0]).step;
    const titleOf = (id: number | null) =>
      z
        .array(z.object({ title: z.string() }))
        .parse(driver.all("SELECT title FROM plan_steps WHERE id = ?", [id]))[0]?.title;
    expect(titleOf(stepOf("OCT-1"))).toBe("L-2 step 2");
    expect(stepOf("OCT-2")).toBeNull();
    expect(stepOf("OCT-3")).toBeNull();
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
