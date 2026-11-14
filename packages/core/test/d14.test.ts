import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const MINUTE = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;
const OPTIONS = [{ key: "a", label: "Yes", description: "Go ahead." }];

/** The features D14 lists beyond the claim and question rules: each as the developer and its agents would use it. */
function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const driver = memoryDriver();
  const tracker = new Tracker(driver, () => now);
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
  as(dev, c.placeAdd, { name: "the Mac" });
  const line = (title: string, where: "working" | "up_next" | "tabled" = "working") =>
    as(dev, c.lineAdd, {
      title,
      doneWhen: "Done.",
      repos: ["PANEL"],
      where,
      ...(where === "tabled" ? { reason: "Later" } : {}),
    });
  const register = (name: string) => {
    as(agent(name), c.agentRegister, { repo: "PANEL" });
    return agent(name);
  };
  const issue = (ref: string) => as(dev, c.issueList, { query: `ref:${ref}` })[0]?.issue;
  return {
    tracker,
    driver,
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

describe("Not yet", () => {
  test("turns down a case for done; the owner hears why through the line's inbox, which wakes it", () => {
    const w = world();
    const line = w.line("Enclosure");
    const owner = w.register("owner");
    w.as(owner, c.lineTake, { ref: line.ref });
    w.as(owner, c.lineProposeDone, { ref: line.ref, why: "It fits." });
    w.as(w.dev, c.lineNotYet, { ref: line.ref, why: "The lid rattles." });
    expect(w.as(w.dev, c.lineShow, { ref: line.ref }).line.doneProposal).toBeNull();
    const heard = w.notices(owner).find((notice) => notice.kind === "not_yet");
    expect([heard?.body.includes("The lid rattles."), heard?.wakes]).toEqual([true, true]);
  });
});

describe("held withdraw", () => {
  test("an agent on the line withdraws held questions and tasks that no longer stand", () => {
    const w = world();
    const line = w.line("Mount", "up_next");
    const scoper = w.register("scoper");
    w.as(scoper, c.lineTake, { ref: line.ref });
    const asked = w.as(scoper, c.decisionAsk, {
      title: "Which wall?",
      context: "Context.",
      options: OPTIONS,
    });
    const task = w.as(scoper, c.taskFile, { title: "Measure", place: "the bench", outcome: "Numbers" });
    w.as(scoper, c.heldWithdraw, { refs: [asked.ref, task.ref], why: "The wall is decided." });
    expect(w.as(w.dev, c.heldList, { line: line.ref })).toEqual([]);
    expect(w.issue(task.ref)?.status).toBe("cancelled");
    expect(() => w.as(w.register("visitor"), c.heldWithdraw, { refs: [asked.ref] })).toThrow();
  });
});

describe("an urgent proposal", () => {
  test("for something broken on a line no agent may work on stands first under Proposed, counted as urgent", () => {
    const w = world();
    w.as(w.agent("panel"), c.linePropose, {
      title: "Later idea",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "Soon.",
    });
    const broken = w.as(w.agent("panel"), c.linePropose, {
      title: "Restore the feed",
      doneWhen: "It loads again.",
      repos: ["PANEL"],
      recommendation: "start",
      why: "The done service broke.",
      urgent: "broken",
    });
    const home = w.as(w.dev, c.homeShow, {});
    expect(home.proposed.map((line) => line.ref)[0]).toBe(broken.ref);
    expect(home.counts.urgent).toBe(1);
    expect(broken.urgentReason).toBe("broken");
  });
});

describe("Try now", () => {
  test("retries every line whose last start failed the same way", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 2, dryRun: false });
    const first = w.line("First");
    const second = w.line("Second");
    w.later(1);
    for (const line of [first, second]) {
      const started = w.as(w.server, c.runnerStart, { line: line.ref, repo: "PANEL" });
      w.as(w.server, c.runnerExited, { name: started.name, code: 1, output: "boot\nclaude: not logged in" });
    }
    expect(w.as(w.server, c.runnerDue, {})).toEqual([]);
    w.as(w.dev, c.runnerRetry, { line: first.ref, same: true });
    expect(w.as(w.server, c.runnerDue, {}).map((due) => due.line)).toEqual([first.ref, second.ref]);
  });

  test("Start one anyway starts a session for a line past the cap, once", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 1, dryRun: false });
    const first = w.line("First");
    w.later(1);
    w.as(w.server, c.runnerStart, { line: first.ref, repo: "PANEL" });
    const second = w.line("Second");
    w.later(1);
    expect(w.as(w.server, c.runnerDue, {})).toEqual([]);
    expect(w.as(w.dev, c.homeShow, {}).lines[second.ref]?.stepIn).toBe(true);
    w.as(w.dev, c.runnerRetry, { line: second.ref, anyway: true });
    expect(w.as(w.server, c.runnerDue, {}).map((due) => due.line)).toEqual([second.ref]);
    w.as(w.server, c.runnerStart, { line: second.ref, repo: "PANEL" });
    expect(w.as(w.server, c.runnerDue, {})).toEqual([]);
  });
});

describe("I'm at", () => {
  test("lists that place's tasks, current held ones on up-next lines included, and ends by itself", () => {
    const w = world();
    const working = w.line("Enclosure");
    const queued = w.line("Mount", "up_next");
    const tabled = w.line("Trip", "tabled");
    const owner = w.register("owner");
    w.as(owner, c.lineTake, { ref: working.ref });
    const here = w.as(owner, c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" });
    w.as(owner, c.taskFile, { title: "Log in", place: "the Mac", outcome: "Done" });
    w.as(owner, c.lineRelease, {});
    const scoper = w.register("scoper");
    w.as(scoper, c.lineTake, { ref: queued.ref });
    const held = w.as(scoper, c.taskFile, { title: "Measure the wall", place: "the bench", outcome: "cm" });
    w.as(w.dev, c.taskFile, { line: tabled.ref, title: "Tabled work", place: "the bench", outcome: "x" });
    w.as(w.dev, c.at, { place: "the bench" });
    const at = w.as(w.dev, c.homeShow, {}).at;
    expect(at?.place).toBe("the bench");
    expect(at?.tasks.map((task) => task.ref)).toEqual([here.ref, held.ref]);
    w.later(4 * HOUR);
    expect(w.as(w.dev, c.homeShow, {}).at).toBeNull();
    expect(() => w.as(w.dev, c.at, { place: "the moon" })).toThrow();
  });

  test("with no place, it leaves", () => {
    const w = world();
    w.as(w.dev, c.at, { place: "the bench" });
    w.as(w.dev, c.at, {});
    expect(w.as(w.dev, c.homeShow, {}).at).toBeNull();
  });
});

describe("seen", () => {
  test("the log shows only what changed on a line since the developer last looked, never their own doing", () => {
    const w = world();
    const line = w.line("Enclosure");
    const owner = w.register("owner");
    w.as(owner, c.lineTake, { ref: line.ref });
    w.as(w.dev, c.seen, { line: line.ref });
    w.later(1);
    w.as(owner, c.planSet, { line: line.ref, steps: ["Model", "Print"] });
    w.as(w.dev, c.lineTell, { line: line.ref, body: "Black, please." });
    const unseen = w.as(w.dev, c.feedList, { unseen: true }).events.map((event) => event.type);
    expect(unseen).toEqual(["line.plan_set"]);
    w.as(w.dev, c.seen, {});
    expect(w.as(w.dev, c.feedList, { unseen: true }).events).toEqual([]);
  });
});

describe("the developer's own line", () => {
  test("takes their tasks, at a place or none, and their notes", () => {
    const w = world();
    const mine = w.as(w.dev, c.lineAdd, { title: "Tax archive", doneWhen: "Filed.", where: "working" });
    const task = w.as(w.dev, c.taskAdd, { line: mine.ref, title: "Scan the receipts" });
    expect([task.line, task.assignee, task.project]).toEqual([mine.ref, "dev", "ME"]);
    w.as(w.dev, c.noteAdd, { line: mine.ref, body: "The 2024 box is in the loft." });
    const notes = w.as(w.dev, c.feedList, { query: `line:${mine.ref} event:status.posted` }).events;
    expect(notes.map((event) => event.summary).join(" ")).toContain("The 2024 box is in the loft.");
    expect(w.as(w.dev, c.homeShow, {}).lines[mine.ref]?.forYou.map((item) => item.kind)).toEqual(["task"]);
    const theirs = w.line("Enclosure");
    expect(() => w.as(w.dev, c.taskAdd, { line: theirs.ref, title: "Not mine" })).toThrow();
    expect(() => w.as(w.agent("panel"), c.noteAdd, { line: mine.ref, body: "x" })).toThrow();
  });
});

describe("refs from before", () => {
  test("an idea's or milestone's ref opens the line it became", () => {
    const w = world();
    const line = w.as(w.agent("panel"), c.linePropose, {
      title: "Old idea",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "Soon.",
    });
    // Migration marks such lines with the ref they came from; a direct write stands in for it here.
    w.driver.run("UPDATE lines SET fromRef = 'I-4' WHERE ref = ?", [line.ref]);
    expect(w.as(w.dev, c.entityShow, { ref: "I-4" }).entity.ref).toBe(line.ref);
  });
});

describe("work on no line", () => {
  test("drift asks for lines, for old proposals to be re-proposed or rejected, and for waiting work to be tasks", () => {
    const w = world();
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Waiting on Vasco", status: "blocked" });
    const drift = w.as(w.dev, c.driftList, { query: "rule:unplaced-work" });
    expect(drift.map((item) => item.suggestion).join(" ")).toContain("task file");
  });
});

describe("proposals from before", () => {
  test("in a repo with no other work, drift still asks its agents to re-propose or reject them", () => {
    const w = world();
    const old = w.as(w.agent("panel"), c.linePropose, {
      title: "Old milestone",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "From before.",
    });
    w.driver.run("UPDATE lines SET fromRef = 'M-2' WHERE ref = ?", [old.ref]);
    w.as(w.dev, c.driftScan, {});
    const drift = w.as(w.dev, c.driftList, { query: "rule:unplaced-work" });
    expect(drift.map((item) => item.message)).toEqual([
      "1 proposal from before in PANEL waits to be re-proposed or rejected",
    ]);
  });
});

describe("the runner at its cap", () => {
  test("asks the lowest helper it started to release after its current issue, once, instead of asking the developer", () => {
    const w = world();
    w.as(w.server, c.runnerReport, { configured: true, cap: 2, dryRun: false });
    const first = w.line("First");
    w.later(1);
    for (const role of ["owner", "helper"] as const) {
      const started = w.as(w.server, c.runnerStart, { line: first.ref, repo: "PANEL" });
      const session = w.agent(started.name);
      w.as(session, c.agentRegister, {});
      expect(w.as(session, c.lineTake, { ref: first.ref }).role).toBe(role);
    }
    const second = w.line("Second");
    w.later(1);
    w.tracker.sweep();
    w.tracker.sweep();
    const asked = w.notices(w.agent("panel.2")).filter((notice) => notice.kind === "release_asked");
    expect(asked.map((notice) => [notice.wakes, notice.body.includes(second.ref)])).toEqual([[true, true]]);
    expect(w.as(w.dev, c.homeShow, {}).lines[second.ref]?.stepIn).toBe(false);
  });
});

describe("a gone session's worktree", () => {
  test("goes to the next session started for its line, which no cleanup removes", () => {
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
    w.as(w.agent("panel.1"), c.agentRegister, {});
    w.as(w.agent("panel.1"), c.lineTake, { ref: line.ref });
    w.as(w.server, c.runnerExited, { name: "panel.1", code: 0, output: "" });
    w.later(15);
    expect(w.as(w.server, c.runnerDue, {}).map((due) => due.line)).toEqual([line.ref]);
    const next = w.as(w.server, c.runnerStart, { line: line.ref, repo: "PANEL" });
    expect([next.name, next.worktree]).toEqual(["panel.2", "/wt/panel.1"]);
    expect(w.as(w.server, c.runnerCleanups, {})).toEqual([]);
  });
});

describe("the developer's stop command", () => {
  test("is due once for each Stop, for the runner to run", () => {
    const w = world();
    w.register("panel");
    w.as(w.dev, c.agentStop, { name: "panel" });
    expect(w.as(w.server, c.runnerStops, {})).toEqual([{ name: "panel" }]);
    w.as(w.server, c.runnerStopRan, { name: "panel", code: 0, output: "" });
    expect(w.as(w.server, c.runnerStops, {})).toEqual([]);
    w.as(w.dev, c.agentLift, { name: "panel" });
    w.as(w.dev, c.agentStop, { name: "panel" });
    expect(w.as(w.server, c.runnerStops, {})).toEqual([{ name: "panel" }]);
    expect(() => w.as(w.dev, c.runnerStopRan, { name: "panel", code: 0, output: "" })).toThrow();
  });
});

describe("a repo's checkout", () => {
  test("is set by the developer only, and kept on the repo", () => {
    const w = world();
    expect(w.as(w.dev, c.repoCheckout, { repo: "PANEL", path: "/src/homepanel" }).checkout).toBe(
      "/src/homepanel",
    );
    expect(() => w.as(w.agent("panel"), c.repoCheckout, { repo: "PANEL", path: "/tmp/evil" })).toThrow();
    expect(() => w.as(w.dev, c.repoCheckout, { repo: "PANEL", path: "relative/path" })).toThrow();
  });
});

describe("proposals on a working line", () => {
  test("a case for done and a new done when come first among what the line needs from the developer", () => {
    const w = world();
    const line = w.line("Enclosure");
    const owner = w.register("owner");
    w.as(owner, c.lineTake, { ref: line.ref });
    w.as(owner, c.decisionAsk, { title: "Which?", context: "Context.", options: OPTIONS });
    w.as(owner, c.lineDoneWhen, { ref: line.ref, doneWhen: "It holds the 30 mm board." });
    w.as(owner, c.lineProposeDone, { ref: line.ref, why: "Printed and fitted." });
    const items = w.as(w.dev, c.homeShow, {}).lines[line.ref]?.forYou ?? [];
    expect(items.map((item) => item.kind)).toEqual(["done", "done_when", "question"]);
    expect(items[0]).toMatchObject({
      kind: "done",
      line: line.ref,
      text: "Printed and fitted.",
      by: "owner",
    });
  });
});

void DAY;
