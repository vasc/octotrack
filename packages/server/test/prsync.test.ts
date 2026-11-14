import { describe, expect, test } from "bun:test";
import { contracts as c, Tracker } from "@octotrack/core";
import { createPrSync } from "../src/prsync.ts";
import { openSqlite } from "../src/sqlite.ts";

const DEV = { actor: "dev", channel: "dashboard" } as const;

function world() {
  const tracker = new Tracker(openSqlite(":memory:"), () => "2026-11-14T09:00:00.000Z");
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" }, DEV);
  const asked: string[] = [];
  const sync = createPrSync(tracker, async (repo) => {
    asked.push(repo);
    return { prs: [{ repo, number: 3, title: "Base", state: "open" }], warnings: [] };
  });
  return { tracker, asked, sync };
}

describe("the server's own pull request sync (third audit, N3)", () => {
  test("syncs every repo a project names, and reports what it found as GitHub", async () => {
    const w = world();
    expect(await w.sync()).toMatchObject({ repos: 1, synced: 1, errors: [] });
    expect(w.asked).toEqual(["vasc/homepanel"]);
    const opened = w.tracker.call(c.feedList, { query: "event:pr.opened" }, DEV).events;
    expect(opened.map((event) => event.actor)).toEqual(["github"]);
  });

  test("a repo asked for by name must be an owner/name, so gh never reads it as an option", async () => {
    const w = world();
    const result = await w.sync(["--help/x", "acme/web"]);
    expect(w.asked).toEqual(["acme/web"]);
    expect(result.errors).toEqual(["--help/x is not a GitHub repo's owner/name"]);
  });
});
