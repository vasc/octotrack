import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const MINUTE = 60_000;

function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const tracker = new Tracker(memoryDriver(), () => now);
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const runner: Caller = { actor: "octotrack", channel: "cli", system: true };
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" }, dev);
  tracker.call(c.runnerReport, { configured: true, cap: 2, dryRun: false }, runner);
  const line = (title: string) =>
    tracker.call(c.lineAdd, { title, doneWhen: "Done.", repos: ["PANEL"], where: "working" }, dev);
  return {
    tracker,
    dev,
    runner,
    line,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
  };
}

describe("owner search step 3: a session the start command runs", () => {
  test("a working line nobody took is due a start once step 2 has run its course, up to the cap", () => {
    const w = world();
    const first = w.line("Enclosure");
    w.line("Mount");
    w.line("Widgets");
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    w.later(1);
    const due = w.tracker.call(c.runnerDue, {}, w.runner);
    expect(due.map((start) => [start.line, start.repo])).toEqual([
      [first.ref, "PANEL"],
      ["L-2", "PANEL"],
    ]);
  });

  test("a start is numbered upward from the repo's name, and the session it runs is that agent", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    const started = w.tracker.call(
      c.runnerStart,
      { line: line.ref, repo: "PANEL", worktree: "/wt/panel.1" },
      w.runner,
    );
    expect(started.name).toBe("panel.1");
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    const session: Caller = { actor: "panel.1", channel: "cli", checkout: "/wt/panel.1" };
    w.tracker.call(c.lineTake, { ref: line.ref }, session);
    const agent = w.tracker.call(c.agentList, {}, w.dev).find((item) => item.name === "panel.1");
    expect([agent?.startedBy, agent?.repo, agent?.line]).toEqual(["octotrack", "PANEL", line.ref]);
  });

  test("a start that fails at once spends nothing and is retried with the same name, less often each time", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL", worktree: "/wt/panel.1" }, w.runner);
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 1, output: "claude: not logged in" }, w.runner);
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    w.later(2);
    const retry = w.tracker.call(c.runnerDue, {}, w.runner);
    expect(retry.map((start) => [start.line, start.name])).toEqual([[line.ref, "panel.1"]]);
    const home = w.tracker.call(c.homeShow, {}, w.dev);
    expect(home.lines[line.ref]?.start).toMatchObject({
      state: "failed",
      output: "claude: not logged in",
      attempts: 1,
    });
  });

  test("a session that ran and exited ends its claim, and is gone with no wake address", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL", worktree: "/wt/panel.1" }, w.runner);
    w.tracker.call(
      c.lineTake,
      { ref: line.ref },
      { actor: "panel.1", channel: "cli", checkout: "/wt/panel.1" },
    );
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 0, output: "" }, w.runner);
    const agent = w.tracker.call(c.agentList, {}, w.dev).find((item) => item.name === "panel.1");
    expect([agent?.state, agent?.line]).toEqual(["gone", null]);
  });

  test("Try now clears the wait on a failing start", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL", worktree: "/wt/panel.1" }, w.runner);
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 1, output: "no" }, w.runner);
    w.tracker.call(c.runnerRetry, { line: line.ref }, w.dev);
    expect(w.tracker.call(c.runnerDue, {}, w.runner).map((start) => start.line)).toEqual([line.ref]);
  });
});

describe("closing up after a line ends", () => {
  test("pull requests still open on a done line are to be closed once its wind-down is over, once", () => {
    const w = world();
    const line = w.line("Enclosure");
    const issue = w.tracker.call(c.issueCreate, { project: "PANEL", title: "Base", line: line.ref }, w.dev);
    w.tracker.call(
      c.prUpsert,
      { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
      w.runner,
    );
    w.tracker.call(c.lineDone, { ref: line.ref }, w.dev);
    expect(w.tracker.call(c.runnerCloses, {}, w.runner)).toEqual([]);
    w.later(16);
    w.tracker.sweep();
    const closes = w.tracker.call(c.runnerCloses, {}, w.runner);
    expect(closes.map((close) => [close.repo, close.number, close.line])).toEqual([
      ["vasc/homepanel", 14, line.ref],
    ]);
    w.tracker.call(c.runnerClosed, { pr: closes[0]?.pr ?? "" }, w.runner);
    expect(w.tracker.call(c.runnerCloses, {}, w.runner)).toEqual([]);
  });

  test("a worktree Octotrack made is offered for removal once nobody uses it", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL", worktree: "/wt/panel.1" }, w.runner);
    w.tracker.call(
      c.runnerWorktree,
      {
        path: "/wt/panel.1",
        repo: "PANEL",
        checkout: "/src/panel",
        branch: "octo/panel.1",
        agent: "panel.1",
      },
      w.runner,
    );
    w.tracker.call(
      c.lineTake,
      { ref: line.ref },
      { actor: "panel.1", channel: "cli", checkout: "/wt/panel.1" },
    );
    expect(w.tracker.call(c.runnerCleanups, {}, w.runner)).toEqual([]);
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 0, output: "" }, w.runner);
    expect(w.tracker.call(c.runnerCleanups, {}, w.runner).map((tree) => tree.path)).toEqual(["/wt/panel.1"]);
    w.tracker.call(c.runnerRemoved, { path: "/wt/panel.1" }, w.runner);
    expect(w.tracker.call(c.runnerCleanups, {}, w.runner)).toEqual([]);
  });
});

describe("only the server's runner records starts", () => {
  test("an agent cannot say a session exited", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL" }, w.runner);
    expect(() =>
      w.tracker.call(
        c.runnerExited,
        { name: "panel.1", code: 1, output: "" },
        { actor: "mallory", channel: "cli" },
      ),
    ).toThrow("Only the server's runner records this");
  });
});
