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
    const result = await w.sync(["--help/x", "vasc/homepanel"]);
    expect(w.asked).toEqual(["vasc/homepanel"]);
    expect(result.errors).toEqual(["--help/x is not a GitHub repo's owner/name"]);
  });
});

describe("what the fourth audit found in pull request sync", () => {
  test("A24: only repos a project here names are synced; any other asked for is reported, not fetched", async () => {
    const w = world();
    const result = await w.sync(["acme/web", "VASC/HomePanel"]);
    expect(w.asked).toEqual(["vasc/homepanel"]);
    expect(result.errors).toEqual(["acme/web is not a repo any project here names"]);
    expect(w.tracker.call(c.prList, { query: "repo:acme/web" }, DEV)).toEqual([]);
  });

  test("A24: a scheduled sync that finds one running runs once it ends, rather than being dropped", async () => {
    const tracker = new Tracker(openSqlite(":memory:"), () => "2026-11-14T09:00:00.000Z");
    tracker.call(c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" }, DEV);
    tracker.call(c.projectCreate, { key: "WEB", name: "Web", repo: "vasc/web" }, DEV);
    const asked: string[] = [];
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sync = createPrSync(tracker, async (repo) => {
      asked.push(repo);
      if (asked.length === 1) await held;
      return { prs: [], warnings: [] };
    });
    const requested = sync(["vasc/web"]);
    const scheduled = sync(undefined, { wait: true });
    const again = sync(undefined, { wait: true });
    expect((await sync(["vasc/web"])).errors).toEqual(["A sync is already running"]);
    release();
    expect((await requested).errors).toEqual([]);
    expect(await scheduled).toMatchObject({ repos: 2, errors: [] });
    expect(await again).toMatchObject({ repos: 2, errors: [] });
    expect(asked).toEqual(["vasc/web", "vasc/homepanel", "vasc/web"]);
  });
});
