import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const MINUTE = 60_000;
const DAY = 24 * 60;
const OPTIONS = [{ key: "a", label: "Yes", description: "Go ahead." }];

function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const tracker = new Tracker(memoryDriver(), () => now);
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const server: Caller = { actor: "octotrack", channel: "cli", system: true };
  const agent = (name: string): Caller => ({ actor: name, channel: "cli" });
  function as<I extends z.ZodType, O extends z.ZodType>(
    caller: Caller,
    contract: Contract<I, O>,
    input: z.input<I>,
  ) {
    return tracker.call(contract, input, caller);
  }
  const notices = (caller: Caller) => tracker.execute(c.agentList.name, {}, caller).notices;
  as(dev, c.projectCreate, { key: "PANEL", name: "Panel" });
  as(dev, c.placeAdd, { name: "the bench" });
  const line = (title: string, where: "working" | "up_next" | "tabled" = "working") =>
    as(dev, c.lineAdd, {
      title,
      doneWhen: "Done.",
      repos: ["PANEL"],
      where,
      ...(where === "tabled" ? { reason: "Later" } : {}),
    });
  const register = (name: string, wake?: string) => {
    as(agent(name), c.agentRegister, { repo: "PANEL", ...(wake === undefined ? {} : { wake }) });
    return agent(name);
  };
  const issue = (ref: string) => as(dev, c.issueList, { query: `ref:${ref}` })[0]?.issue;
  return {
    tracker,
    dev,
    server,
    agent,
    as,
    notices,
    line,
    register,
    issue,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
  };
}

describe("what becomes of a line's work when it ends", () => {
  test("Not a line closes the proposer's new issues and returns older work to no line", () => {
    const w = world();
    const old = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Older work" });
    const proposal = w.as(w.agent("panel"), c.linePropose, {
      title: "Widgets",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "Soon.",
    });
    w.as(w.dev, c.issueUpdate, { refs: [old.ref], line: proposal.ref });
    const fresh = w.as(w.agent("panel"), c.issueCreate, {
      project: "PANEL",
      title: "New for it",
      line: proposal.ref,
    });
    w.as(w.dev, c.lineReject, { ref: proposal.ref });
    expect([w.issue(old.ref)?.line, w.issue(old.ref)?.status]).toEqual([null, "todo"]);
    expect(w.issue(fresh.ref)?.status).toBe("cancelled");
  });

  test("Done on a line nobody is on closes its open issues at once", () => {
    const w = world();
    const waiting = w.line("Mount", "up_next");
    const work = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Measure", line: waiting.ref });
    w.as(w.dev, c.lineDone, { ref: waiting.ref });
    expect(w.issue(work.ref)?.status).toBe("cancelled");
  });

  test("folding a line takes its waiting answers along", () => {
    const w = world();
    const keep = w.line("Keep");
    const fold = w.line("Fold");
    const owner = w.register("panel");
    w.as(owner, c.lineTake, { ref: fold.ref });
    const asked = w.as(owner, c.decisionAsk, { title: "Which?", context: "Context.", options: OPTIONS });
    w.as(owner, c.lineRelease, {});
    w.as(w.dev, c.decisionResolve, { ref: asked.ref, option: "a" });
    w.as(w.dev, c.lineFold, { ref: fold.ref, into: keep.ref });
    const next = w.register("next");
    const taken = w.tracker.execute(c.lineTake.name, { ref: keep.ref }, next);
    expect(taken.notices.map((notice) => notice.kind)).toContain("answer");
  });
});

describe("an agent leaving a line leaves its issues for the next", () => {
  test("its open issues go back to the line, and whoever takes one hears who held it", () => {
    const w = world();
    const line = w.line("Enclosure");
    const work = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Base", line: line.ref });
    const first = w.register("first");
    w.as(first, c.lineTake, { ref: line.ref });
    w.as(first, c.issueClaim, { refs: [work.ref] });
    w.as(first, c.lineRelease, {});
    expect([w.issue(work.ref)?.assignee, w.issue(work.ref)?.status]).toEqual([null, "todo"]);
    const second = w.register("second");
    const taken = w.as(second, c.lineTake, { ref: line.ref });
    expect(taken.next?.ref).toBe(work.ref);
    expect(taken.message).toContain("last held by first");
  });
});

describe("a session Octotrack started that can be woken", () => {
  test("keeps its line when its process exits, and stops counting against the cap", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 1, dryRun: false });
    const first = w.line("First");
    w.later(1);
    w.as(w.server, c.runnerStart, { line: first.ref, repo: "PANEL" });
    const session = w.agent("panel.1");
    w.as(session, c.agentRegister, { wake: "screen:panel-1" });
    w.as(session, c.lineTake, { ref: first.ref });
    w.as(w.server, c.runnerExited, { name: "panel.1", code: 0, output: "" });
    const listed = w.as(w.dev, c.agentList, {}).find((agent) => agent.name === "panel.1");
    expect(listed?.line).toBe(first.ref);
    w.later(20);
    const later = w.as(w.dev, c.agentList, {}).find((agent) => agent.name === "panel.1");
    expect([later?.state, later?.line]).toEqual(["asleep", first.ref]);
    const second = w.line("Second");
    w.later(1);
    expect(w.as(w.server, c.runnerDue, {}).map((due) => due.line)).toEqual([second.ref]);
  });

  test("a start that never checks in within five minutes stops holding its line's turn", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 2, dryRun: false });
    const line = w.line("First");
    w.later(1);
    const started = w.as(w.server, c.runnerStart, { line: line.ref, repo: "PANEL" });
    w.as(w.server, c.runnerSpawned, { name: started.name, pid: 4242 });
    w.later(6);
    w.tracker.sweep();
    expect(w.as(w.dev, c.homeShow, {}).lines[line.ref]?.start?.state).toBe("never_took");
  });

  test("session names never reuse an agent's name", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 2, dryRun: false });
    w.register("panel.1");
    const line = w.line("First");
    w.later(1);
    expect(w.as(w.server, c.runnerStart, { line: line.ref, repo: "PANEL" }).name).toBe("panel.2");
  });
});

describe("held work reaches the developer only while it is current", () => {
  test("a question held for more than 7 days stays out of the queue when its line starts, until re-confirmed", () => {
    const w = world();
    const line = w.line("Mount", "up_next");
    const scoper = w.register("scoper");
    w.as(scoper, c.lineTake, { ref: line.ref });
    const asked = w.as(scoper, c.decisionAsk, {
      title: "Which wall?",
      context: "Context.",
      options: OPTIONS,
    });
    w.as(scoper, c.lineRelease, {});
    w.later(8 * DAY);
    w.as(w.dev, c.lineStart, { ref: line.ref });
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([]);
    const owner = w.register("owner");
    w.as(owner, c.lineTake, { ref: line.ref });
    w.as(owner, c.heldConfirm, { refs: [asked.ref] });
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([asked.ref]);
  });
});

describe("the search for an owner", () => {
  test("does not ask the developer to step in while all of a line's work waits on them", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 1, dryRun: false });
    const line = w.line("Enclosure");
    w.as(w.dev, c.taskFile, { line: line.ref, title: "Measure", place: "the bench", outcome: "Numbers" });
    w.later(1);
    expect(w.as(w.dev, c.homeShow, {}).lines[line.ref]?.stepIn).toBe(false);
    expect(w.as(w.server, c.runnerDue, {})).toEqual([]);
  });

  test("ends its first step when the last owner cannot be woken", () => {
    const w = world();
    const line = w.line("Enclosure");
    const owner = w.register("owner", "screen:owner");
    w.as(owner, c.lineTake, { ref: line.ref });
    w.as(w.dev, c.lineQueue, { ref: line.ref });
    w.later(20);
    w.as(w.dev, c.lineStart, { ref: line.ref });
    expect(w.as(w.dev, c.homeShow, {}).crews[line.ref]?.search?.step).toBe(1);
    w.as(w.server, c.agentWoken, { name: "owner", error: "Exit 1" });
    expect(w.as(w.dev, c.homeShow, {}).crews[line.ref]?.search?.step).toBe(2);
  });
});

describe("the developer releasing a quiet agent", () => {
  test("ends its claim and frees its issues, tells it, and refuses an agent that does not quote the developer", () => {
    const w = world();
    const line = w.line("Enclosure");
    const work = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Base", line: line.ref });
    const quiet = w.register("quiet");
    w.as(quiet, c.lineTake, { ref: line.ref });
    w.as(quiet, c.issueClaim, { refs: [work.ref] });
    expect(() => w.as(w.agent("other"), c.agentRelease, { name: "quiet" })).toThrow("Only the developer");
    w.as(w.dev, c.agentRelease, { name: "quiet" });
    expect(w.as(w.dev, c.agentList, {}).find((agent) => agent.name === "quiet")?.line).toBeNull();
    expect(w.issue(work.ref)?.assignee).toBeNull();
    expect(
      w
        .notices(quiet)
        .map((notice) => notice.body)
        .join(" "),
    ).toContain("The developer released you");
  });
});

describe("lines and repos", () => {
  test("a line added with no repo is the developer's own, and no agent takes it", () => {
    const w = world();
    const mine = w.as(w.dev, c.lineAdd, { title: "Tax archive", doneWhen: "Filed.", where: "working" });
    expect(mine.ownedBy).toBe("dev");
    expect(() => w.as(w.register("panel"), c.lineTake, { ref: mine.ref })).toThrow();
  });

  test("an up-next line still winding down is not taken to scope", () => {
    const w = world();
    const line = w.line("Mount");
    const owner = w.register("owner");
    w.as(owner, c.lineTake, { ref: line.ref });
    w.as(w.dev, c.lineQueue, { ref: line.ref });
    expect(() => w.as(w.register("scoper"), c.lineTake, { ref: line.ref })).toThrow("winding down");
  });
});

describe("worktrees", () => {
  test("one whose session is still starting is not offered for removal, though its path was not known at the start", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 1, dryRun: false });
    const line = w.line("First");
    w.later(1);
    w.as(w.server, c.runnerStart, { line: line.ref, repo: "PANEL" });
    w.as(w.server, c.runnerWorktree, {
      path: "/wt/panel.1",
      repo: "PANEL",
      checkout: "/src/panel",
      branch: "octo/panel.1",
      agent: "panel.1",
    });
    expect(w.as(w.server, c.runnerCleanups, {})).toEqual([]);
  });

  test("one still used as a checkout by a live agent is not offered for removal", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 1, dryRun: false });
    const line = w.line("First");
    w.later(1);
    w.as(w.server, c.runnerStart, { line: line.ref, repo: "PANEL", worktree: "/wt/panel.1" });
    w.as(w.server, c.runnerWorktree, {
      path: "/wt/panel.1",
      repo: "PANEL",
      checkout: "/src/panel",
      branch: "octo/panel.1",
      agent: "panel.1",
    });
    w.as(w.server, c.runnerExited, { name: "panel.1", code: 1, output: "no" });
    w.as({ actor: "visitor", channel: "cli", checkout: "/wt/panel.1" }, c.agentNote, { note: "here" });
    expect(w.as(w.server, c.runnerCleanups, {})).toEqual([]);
  });
});
