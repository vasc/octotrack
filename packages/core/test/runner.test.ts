import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { GITHUB, memoryDriver } from "./helpers.ts";

const MINUTE = 60_000;

function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const driver = memoryDriver();
  const tracker = new Tracker(driver, () => now);
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const runner: Caller = { actor: "octotrack", channel: "cli", system: true };
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" }, dev);
  tracker.call(c.runnerReport, { configured: true, cap: 2, dryRun: false }, runner);
  const line = (title: string) =>
    tracker.call(c.lineAdd, { title, doneWhen: "Done.", repos: ["PANEL"], where: "working" }, dev);
  const session = (name: string, checkout?: string): Caller => ({
    actor: name,
    channel: "cli",
    ...(checkout === undefined ? {} : { checkout }),
  });
  const issue = (line: string, title: string) =>
    tracker.call(c.issueCreate, { project: "PANEL", title, line }, dev);
  /** Read straight from the database, since asking as the agent would count as it being at work. */
  const releaseAsked = (agent: string) =>
    driver.all("SELECT body FROM notices WHERE agent = ? AND kind = 'release_asked'", [agent]);
  const cap = (value: number) =>
    tracker.call(c.runnerReport, { configured: true, cap: value, dryRun: false }, runner);
  return {
    tracker,
    dev,
    runner,
    line,
    session,
    issue,
    releaseAsked,
    cap,
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
      c.prSync,
      {
        prs: [
          { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
        ],
      },
      GITHUB,
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

describe("what the runner audit found", () => {
  /** A session started for the line, which took it and then exited with no wake address: gone, its worktree left. */
  function goneOwner(w: ReturnType<typeof world>, line: string) {
    w.tracker.call(c.runnerStart, { line, repo: "PANEL", worktree: "/wt/panel.1" }, w.runner);
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
    w.tracker.call(c.lineTake, { ref: line }, w.session("panel.1", "/wt/panel.1"));
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 0, output: "" }, w.runner);
  }

  test("a pull request in another repo is never closed, whatever it says it fixes", () => {
    const w = world();
    const line = w.line("Enclosure");
    const issue = w.issue(line.ref, "Base");
    w.tracker.call(
      c.prSync,
      {
        prs: [
          { repo: "vasc/other-repo", number: 99, title: "Other", state: "open", body: `Fixes ${issue.ref}` },
        ],
      },
      GITHUB,
    );
    w.tracker.call(c.lineDone, { ref: line.ref }, w.dev);
    w.later(16);
    w.tracker.sweep();
    expect(w.tracker.call(c.runnerCloses, {}, w.runner)).toEqual([]);
  });

  test("a pull request that also implements work on a line still being worked on is left open", () => {
    const w = world();
    const ended = w.line("Enclosure");
    const working = w.line("Mount");
    const done = w.issue(ended.ref, "Base");
    const open = w.issue(working.ref, "Bracket");
    w.tracker.call(
      c.prSync,
      {
        prs: [
          {
            repo: "vasc/homepanel",
            number: 15,
            title: "Both",
            state: "open",
            body: `Fixes ${done.ref} and ${open.ref}`,
          },
        ],
      },
      GITHUB,
    );
    w.tracker.call(c.lineDone, { ref: ended.ref }, w.dev);
    w.later(16);
    w.tracker.sweep();
    expect(w.tracker.call(c.runnerCloses, {}, w.runner)).toEqual([]);
  });

  test("a retry after a hand-over keeps the worktree it was handed, unpushed work and all", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    goneOwner(w, line.ref);
    w.later(15);
    const handed = w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL" }, w.runner);
    expect([handed.name, handed.worktree]).toEqual(["panel.2", "/wt/panel.1"]);
    w.tracker.call(c.runnerExited, { name: "panel.2", code: 1, output: "claude: not logged in" }, w.runner);
    w.later(2);
    expect(w.tracker.call(c.runnerDue, {}, w.runner).map((due) => due.name)).toEqual(["panel.2"]);
    const retry = w.tracker.call(
      c.runnerStart,
      { line: line.ref, repo: "PANEL", worktree: "/wt/panel.2" },
      w.runner,
    );
    expect([retry.name, retry.worktree]).toEqual(["panel.2", "/wt/panel.1"]);
  });

  test("a gone session's worktree is not handed on while another agent works in it", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    goneOwner(w, line.ref);
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, w.session("visitor", "/wt/panel.1"));
    w.later(15);
    expect(w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL" }, w.runner).worktree).toBeNull();
  });

  test("a session that ran past its check-in and then exited with an error is not retried by itself", () => {
    const w = world();
    const line = w.line("Enclosure");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: line.ref, repo: "PANEL" }, w.runner);
    w.later(6);
    w.tracker.sweep();
    w.later(34);
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 1, output: "killed" }, w.runner);
    expect(w.tracker.call(c.homeShow, {}, w.dev).lines[line.ref]?.start?.state).toBe("never_took");
    w.later(10);
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
  });

  test("a session that never took its line still counts against the cap until its process exits", () => {
    const w = world();
    w.cap(1);
    const first = w.line("Enclosure");
    const second = w.line("Mount");
    w.later(1);
    expect(w.tracker.call(c.runnerDue, {}, w.runner).map((due) => due.line)).toEqual([first.ref]);
    w.tracker.call(c.runnerStart, { line: first.ref, repo: "PANEL" }, w.runner);
    w.later(16);
    w.tracker.sweep();
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    w.tracker.call(c.runnerExited, { name: "panel.1", code: 0, output: "" }, w.runner);
    expect(w.tracker.call(c.runnerDue, {}, w.runner).map((due) => due.line)).toEqual([second.ref]);
  });

  test("at the cap, an asleep helper is not asked to make room, since it holds no session", () => {
    const w = world();
    const first = w.line("Enclosure");
    w.later(1);
    for (const [name, role] of [
      ["panel.1", "owner"],
      ["panel.2", "helper"],
    ] as const) {
      w.tracker.call(c.runnerStart, { line: first.ref, repo: "PANEL" }, w.runner);
      w.tracker.call(c.agentRegister, { wake: `claude:${name}` }, w.session(name));
      expect(w.tracker.call(c.lineTake, { ref: first.ref }, w.session(name)).role).toBe(role);
    }
    w.later(16);
    // The owner is at work; the helper went to sleep.
    w.tracker.call(c.agentRegister, {}, w.session("panel.1"));
    w.cap(1);
    const second = w.line("Mount");
    w.later(1);
    w.tracker.call(c.agentRegister, {}, w.session("panel.1"));
    w.tracker.sweep();
    w.tracker.sweep();
    expect(w.tracker.call(c.homeShow, {}, w.dev).lines[second.ref]?.stepIn).toBe(true);
    expect(w.releaseAsked("panel.2")).toEqual([]);
  });

  test("making room asks no helper to give way for a line the runner would not start", () => {
    const w = world();
    w.cap(3);
    const first = w.line("Enclosure");
    const second = w.line("Mount");
    w.later(1);
    for (const name of ["panel.1", "panel.2"]) {
      w.tracker.call(c.runnerStart, { line: first.ref, repo: "PANEL" }, w.runner);
      w.tracker.call(c.lineTake, { ref: first.ref }, w.session(name));
    }
    w.tracker.call(c.runnerStart, { line: second.ref, repo: "PANEL" }, w.runner);
    w.later(6);
    w.tracker.sweep();
    w.tracker.call(c.runnerExited, { name: "panel.3", code: 0, output: "" }, w.runner);
    expect(w.tracker.call(c.homeShow, {}, w.dev).lines[second.ref]?.start?.state).toBe("never_took");
    w.cap(2);
    w.tracker.sweep();
    expect(w.releaseAsked("panel.2")).toEqual([]);
  });

  test("once every working line has an owner, spare sessions go to helpers for unclaimed work, in line order", () => {
    const w = world();
    const first = w.line("Enclosure");
    const second = w.line("Mount");
    w.issue(first.ref, "Base");
    w.issue(first.ref, "Lid");
    w.later(1);
    for (const [line, name] of [
      [first.ref, "panel.1"],
      [second.ref, "panel.2"],
    ] as const) {
      w.tracker.call(c.runnerStart, { line, repo: "PANEL" }, w.runner);
      w.tracker.call(c.lineTake, { ref: line }, w.session(name));
    }
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    w.cap(4);
    // The owner of the first line takes one issue; the other waits for a helper. The second line has no work.
    const due = w.tracker.call(c.runnerDue, {}, w.runner);
    expect(due.map((start) => [start.line, start.role])).toEqual([[first.ref, "helper"]]);
    const helper = w.tracker.call(
      c.runnerStart,
      { line: first.ref, repo: "PANEL", role: "helper" },
      w.runner,
    );
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    expect(w.tracker.call(c.lineTake, { ref: first.ref }, w.session(helper.name)).role).toBe("helper");
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
  });

  test("no helper is started while a working line is still looking for its owner", () => {
    const w = world();
    w.cap(3);
    const first = w.line("Enclosure");
    w.issue(first.ref, "Base");
    w.issue(first.ref, "Lid");
    w.later(1);
    w.tracker.call(c.runnerStart, { line: first.ref, repo: "PANEL" }, w.runner);
    w.tracker.call(c.lineTake, { ref: first.ref }, w.session("panel.1"));
    const second = w.line("Mount");
    expect(w.tracker.call(c.runnerDue, {}, w.runner)).toEqual([]);
    w.later(1);
    const due = w.tracker.call(c.runnerDue, {}, w.runner);
    expect(due.map((start) => [start.line, start.role])).toEqual([
      [second.ref, "owner"],
      [first.ref, "helper"],
    ]);
  });
});

describe("closing pull requests only when it is safe (third audit, N2)", () => {
  const github: Caller = { actor: "github", channel: "cli", system: true };
  /** A line with one issue, its pull request as GitHub reports it, and the line done with its wind-down over. */
  function ended(body: (issue: string) => string, headRef = "feature") {
    const w = world();
    const line = w.line("Enclosure");
    const issue = w.issue(line.ref, "Base");
    const sync = (number: number, text: string, sha = "aaa") =>
      w.tracker.call(
        c.prSync,
        {
          prs: [
            {
              repo: "vasc/homepanel",
              number,
              title: "Base",
              state: "open",
              body: text,
              headRef,
              headSha: sha,
            },
          ],
        },
        github,
      );
    sync(14, body(issue.ref));
    w.tracker.call(c.lineDone, { ref: line.ref }, w.dev);
    w.later(16);
    w.tracker.sweep();
    const closes = () => w.tracker.call(c.runnerCloses, {}, w.runner).map((close) => close.number);
    return { w, line, issue, sync, closes };
  }

  test("a pull request that only mentions an issue does not implement it, so it is never closed with it", () => {
    const e = ended((issue) => `See ${issue} for background.`);
    expect(e.closes()).toEqual([]);
    const shown = e.w.tracker.call(c.entityShow, { ref: "vasc/homepanel#14" }, e.w.dev);
    expect(shown.links).toEqual([]);
  });

  test("a closing keyword or the branch name links it, and then it is closed", () => {
    expect(ended((issue) => `Fixes ${issue}`).closes()).toEqual([14]);
    expect(ended(() => "The base.", "panel-1-base").closes()).toEqual([14]);
  });

  test("one opened after the wind-down is shown and held, never closed", () => {
    const e = ended((issue) => `Fixes ${issue}`);
    e.sync(40, `Fixes ${e.issue.ref}`);
    expect(e.closes()).toEqual([14]);
    const late = e.w.tracker.call(c.feedList, { query: "event:pr.after_wind_down" }, e.w.dev).events;
    expect(late.map((event) => event.line)).toEqual([e.line.ref]);
  });

  test("one pushed to after the wind-down is not closed", () => {
    const e = ended((issue) => `Fixes ${issue}`);
    e.sync(14, `Fixes ${e.issue.ref}`, "bbb");
    expect(e.closes()).toEqual([]);
  });

  test("a pull request an agent reported, and GitHub never confirmed, is not closed", () => {
    const w = world();
    const line = w.line("Enclosure");
    const issue = w.issue(line.ref, "Base");
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, w.session("panel.9"));
    w.tracker.call(c.lineTake, { ref: line.ref }, w.session("panel.9"));
    w.tracker.call(
      c.prUpsert,
      { repo: "vasc/homepanel", number: 77, title: "Not mine", state: "open", body: `Fixes ${issue.ref}` },
      w.session("panel.9"),
    );
    w.tracker.call(c.lineDone, { ref: line.ref }, w.dev);
    w.later(16);
    w.tracker.sweep();
    expect(w.tracker.call(c.runnerCloses, {}, w.runner)).toEqual([]);
  });
});
