import { beforeEach, describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import type { WatchSpec } from "../src/schemas.ts";
import { GITHUB, type Harness, harness } from "./helpers.ts";

let h: Harness;
let notifications: number;

const SPEC: WatchSpec = {
  require: "any",
  clauses: [{ type: "state", query: '"text that nothing contains"', mode: "exists" }],
};

/** Runs something and says how many times the dashboard's stream would have been told about it. */
function notified(action: () => void): number {
  const before = notifications;
  action();
  return notifications - before;
}

/** Saved constantly and seen by nobody else: polls, drafts, and what the server says about notifications. */
const QUIET: ReadonlySet<string> = new Set([
  c.watchCheck.name,
  c.draftSave.name,
  c.pushSeen.name,
  c.pushSent.name,
]);

/** The developer's operations run as the developer; everything else as an agent. */
const DEVELOPER_OPS: ReadonlySet<string> = new Set([
  "line.add",
  "line.order",
  "line.queue",
  "line.start",
  "line.table",
  "line.done",
  "line.drop",
  "line.reject",
  "line.fold",
  "agent.stop",
  "agent.lift",
  "agent.release",
  "repo.checkout",
  "line.tell",
  "decision.not_urgent",
  "task.done",
  "task.cant",
  "place.add",
  "place.remove",
  "line.done_when",
  "line.done_when_answer",
  "line.summarize",
  "line.propose_done",
  "line.not_yet",
  "held.withdraw",
  "held.confirm",
  "at",
  "seen",
  "task.add",
  "note.add",
  "line.own",
  "line.hand",
  "choice.make",
  "choice.undo",
  "choice.now",
  "line.accept_recommended",
  "runner.retry",
  "push.subscribe",
  "push.unsubscribe",
]);
function execute(name: string, input: unknown): void {
  const serverOnly =
    (name.startsWith("runner.") && name !== "runner.retry") || name.endsWith(".woken") || name === "pr.sync";
  const caller = serverOnly ? { ...h.as, system: true } : h.as;
  h.tracker.execute(name, input, DEVELOPER_OPS.has(name) ? { ...caller, developer: true } : caller);
}

beforeEach(() => {
  h = harness();
  notifications = 0;
  h.tracker.subscribe(() => {
    notifications += 1;
  });
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack" });
  h.call(c.issueCreate, { project: "OCT", title: "An issue" });
  h.call(c.decisionAsk, {
    title: "A decision",
    project: "OCT",
    options: [{ key: "a", label: "A" }],
  });
  h.call(c.decisionAsk, { title: "Another decision", project: "OCT" });
  h.call(c.decisionAsk, { title: "A third decision", project: "OCT" });
  h.call(c.prUpsert, { repo: "a/b", number: 1, title: "A PR", state: "open" });
  h.call(c.viewSave, { name: "Mine", query: "kind:issue" });
  h.call(c.watchCreate, { spec: SPEC, name: "registered" });
  h.developer(c.lineAdd, { title: "A line", doneWhen: "Done.", repos: ["OCT"], where: "working" });
  h.call(c.linePropose, { title: "A proposal", doneWhen: "Done.", recommendation: "up_next", why: "Soon." });
  h.call(c.linePropose, { title: "The same work", doneWhen: "Done.", recommendation: "fold", why: "Same." });
  h.developer(c.lineAdd, { title: "Next", doneWhen: "Done.", repos: ["OCT"], where: "up_next" });
  h.developer(c.decisionAsk, { title: "Order today?", line: "L-1", urgent: "costs_money" });
  h.developer(c.placeAdd, { name: "the bench" });
  h.call(c.agentRegister, { repo: "OCT" }, "owner.b");
  h.call(c.lineTake, { ref: "L-1" }, "owner.b");
  h.call(c.lineDoneWhen, { ref: "L-1", doneWhen: "Proposed by its owner" }, "owner.b");
  for (const title of ["Weigh", "Count"]) {
    h.developer(c.taskFile, { line: "L-1", title, place: "the bench", outcome: "A number", frees: "OCT-1" });
  }
});

/**
 * One real call for every operation that writes. Listed by hand on purpose, so that adding an operation fails the
 * coverage test below until someone has thought about whether the dashboard hears about it.
 */
const EVERY_WRITE: readonly (readonly [string, unknown])[] = [
  ["project.create", { key: "API", name: "API" }],
  ["project.update", { ref: "OCT", description: "Changed" }],
  ["issue.create", { project: "OCT", title: "New" }],
  ["issue.update", { refs: ["OCT-1"], priority: "high" }],
  ["issue.claim", { refs: ["OCT-1"] }],
  ["issue.release", { refs: ["OCT-1"] }],
  ["decision.ask", { title: "New" }],
  ["decision.update", { ref: "D-1", priority: "high" }],
  ["decision.postpone", { ref: "D-1" }],
  ["decision.resolve", { ref: "D-1", option: "a" }],
  ["decision.pickup", { ref: "D-1" }],
  ["decision.report", { ref: "D-1", status: "done", note: "Did it" }],
  ["decision.woken", { ref: "D-1" }],
  ["decision.resolve_batch", { text: "D-2 - Yes" }],
  ["decision.record", { title: "Old", chosen: "That" }],
  ["decision.reopen", { ref: "D-1" }],
  ["decision.withdraw", { ref: "D-1" }],
  ["decision.supersede", { ref: "D-2", by: "D-3" }],
  ["pr.upsert", { repo: "a/b", number: 1, title: "Renamed", state: "open" }],
  ["pr.sync", { prs: [{ repo: "a/b", number: 2, title: "Another", state: "open" }] }],
  ["link.add", { from: "OCT-1", rel: "relates", to: "D-1" }],
  ["link.remove", { from: "OCT-1", rel: "relates", to: "D-1" }],
  ["update.post", { body: "Hello", target: "OCT-1" }],
  ["drift.claim", { refs: ["DR-1"] }],
  ["drift.ack", { target: "OCT", mode: "verified", note: "Fine" }],
  ["drift.scan", {}],
  ["view.save", { name: "Other", query: "kind:pr" }],
  ["view.remove", { name: "Other" }],
  ["watch.create", { spec: SPEC }],
  ["watch.cancel", { refs: ["registered"] }],
  ["agent.note", { note: "Busy" }],
  ["line.add", { title: "New", doneWhen: "Done.", where: "up_next" }],
  ["line.propose", { title: "Idea", doneWhen: "Done.", recommendation: "table", why: "Later." }],
  ["line.order", { ref: "L-5", to: "top" }],
  ["line.queue", { ref: "L-2" }],
  ["line.start", { ref: "L-2" }],
  ["line.table", { ref: "L-2", reason: "Not now" }],
  ["line.done", { ref: "L-2" }],
  ["line.drop", { ref: "L-4" }],
  ["line.reject", { ref: "L-6" }],
  ["line.fold", { ref: "L-3", into: "L-1" }],
  ["agent.register", { wake: "screen:a", repo: "OCT" }],
  ["line.take", { ref: "L-1" }],
  // From the line it took: an agent writes only to the line it is on.
  ["plan.set", { line: "L-1", steps: ["One"] }],
  ["plan.step", { line: "L-1", step: 1, status: "done" }],
  ["line.tell", { line: "L-1", body: "Hello" }],
  ["decision.not_urgent", { ref: "D-4" }],
  ["place.add", { name: "the shed" }],
  ["task.file", { line: "L-1", title: "Measure", place: "the bench", outcome: "Numbers", frees: "OCT-1" }],
  ["line.release", {}],
  ["task.done", { ref: "OCT-2", result: "12 mm" }],
  ["task.cant", { ref: "OCT-3", why: "No scale" }],
  ["held.withdraw", { refs: ["OCT-5"] }],
  ["place.remove", { name: "the shed" }],
  ["held.confirm", { refs: ["D-4"] }],
  ["line.summarize", { ref: "L-1", headline: "Going well.", summary: "All good." }],
  ["line.done_when_answer", { ref: "L-1", accept: true }],
  ["line.done_when", { ref: "L-1", doneWhen: "It ships." }],
  ["line.propose_done", { ref: "L-1", why: "It shipped." }],
  ["line.not_yet", { ref: "L-1" }],
  ["line.own", { ref: "L-1" }],
  ["task.add", { line: "L-1", title: "Mine to do" }],
  ["note.add", { line: "L-1", body: "A note of mine." }],
  ["at", { place: "the bench" }],
  ["seen", {}],
  ["line.hand", { ref: "L-1", repos: ["OCT"] }],
  ["choice.make", { op: "line.start", input: { ref: "L-4" }, summary: "Start Next" }],
  ["choice.undo", { id: 1 }],
  ["choice.make", { op: "line.queue", input: { ref: "L-1" }, summary: "Queue A line" }],
  ["choice.now", { id: 2 }],
  ["line.accept_recommended", { refs: ["L-2"] }],
  ["runner.report", { configured: true, cap: 1, dryRun: false }],
  ["runner.dry", { line: "L-1", repo: "OCT" }],
  ["runner.start", { line: "L-1", repo: "OCT", worktree: "/wt/oct.1" }],
  ["runner.spawned", { name: "oct.1", pid: 4242 }],
  [
    "runner.worktree",
    { path: "/wt/oct.1", repo: "OCT", checkout: "/src/oct", branch: "octo/oct.1", agent: "oct.1" },
  ],
  ["runner.exited", { name: "oct.1", code: 1, output: "not logged in" }],
  ["runner.retry", { line: "L-1" }],
  ["runner.start", { line: "L-1", repo: "OCT" }],
  ["runner.restarted", {}],
  ["runner.closed", { pr: "PR-1", dry: true }],
  ["runner.closed", { pr: "PR-1" }],
  ["runner.removed", { path: "/wt/oct.1" }],
  ["runner.stop_ran", { name: "owner.b", code: 0, output: "" }],
  ["repo.checkout", { repo: "OCT", path: "/src/oct" }],
  ["push.subscribe", { endpoint: "https://push.example/a", keys: { p256dh: "k", auth: "a" } }],
  ["push.unsubscribe", { endpoint: "https://push.example/a" }],
  ["agent.woken", { name: "agent-a" }],
  ["agent.release", { name: "owner.b" }],
  // Last: everything above runs as agent-a, which a stop would refuse.
  ["agent.stop", { name: "agent-a" }],
  ["agent.lift", { name: "agent-a" }],
];

describe("every write reaches the dashboard", () => {
  test("every writing operation is covered here, apart from polling and drafts, which have their own rules", () => {
    const covered = new Set(EVERY_WRITE.map(([name]) => name));
    const missing = Object.values(c)
      // Polls and drafts are saved constantly and change nothing anyone else sees, so they stay quiet.
      .filter((contract) => contract.mutates && !QUIET.has(contract.name))
      .map((contract) => contract.name)
      .filter((name) => !covered.has(name));
    expect(missing).toEqual([]);
  });

  test("each one notifies, including those that leave nothing in the feed", () => {
    const silent = EVERY_WRITE.filter(([name, input]) => notified(() => execute(name, input)) === 0).map(
      ([name]) => name,
    );
    expect(silent).toEqual([]);
  });

  test("an atomic batch notifies even when none of its operations produce a feed event", () => {
    expect(
      notified(() => h.tracker.batch({ ops: [{ op: "agent.note", input: { note: "Busy" } }] }, h.as)),
    ).toBe(1);
    expect(
      notified(() => h.tracker.batch({ ops: [{ op: "view.save", input: { name: "B", query: "" } }] }, h.as)),
    ).toBe(1);
  });

  test("a batch that rolled back changed nothing, so it says nothing", () => {
    expect(
      notified(() =>
        h.tracker.batch(
          {
            ops: [
              { op: "agent.note", input: { note: "Busy" } },
              { op: "issue.create", input: { project: "NOPE", title: "Fails" } },
            ],
          },
          h.as,
        ),
      ),
    ).toBe(0);
  });

  test("a sync that changed nothing still updates when it last synced", () => {
    const pr = { repo: "a/b", number: 1, title: "A PR", state: "open" } as const;
    expect(notified(() => h.tracker.call(c.prSync, { prs: [pr] }, GITHUB))).toBe(1);
  });

  test("an agent seen for the first time shows up, even from a read, but only the first time", () => {
    expect(notified(() => h.call(c.issueList, {}, "brand-new-agent"))).toBe(1);
    expect(notified(() => h.call(c.issueList, {}, "brand-new-agent"))).toBe(0);
  });
});

describe("first contact from an agent", () => {
  test("a failed first write still records the agent, so that its next call works", () => {
    expect(() => h.call(c.issueCreate, { project: "NOPE", title: "Fails" }, "newcomer")).toThrow();
    expect(h.call(c.agentNote, { note: "Here now" }, "newcomer").note).toBe("Here now");
  });
});

describe("polling must not flood the dashboard", () => {
  test("a registered watch starting to be polled shows up as waiting, once", () => {
    expect(notified(() => h.call(c.watchCheck, { refs: ["registered"] }))).toBe(1);
    expect(notified(() => h.call(c.watchCheck, { refs: ["registered"] }))).toBe(0);
    expect(notified(() => h.call(c.watchCheck, { refs: ["registered"] }))).toBe(0);
  });

  test("a watch that went quiet and came back shows up again", () => {
    h.call(c.watchCheck, { refs: ["registered"] });
    h.setNow("2026-11-07T12:10:00.000Z");
    expect(notified(() => h.call(c.watchCheck, { refs: ["registered"] }))).toBe(1);
  });

  test("a watch firing shows up, since it stops waiting", () => {
    h.call(c.watchCheck, { refs: ["registered"] });
    h.call(c.issueCreate, { project: "OCT", title: "Unrelated" });
    const firing = h.call(c.watchCreate, {
      spec: { require: "any", clauses: [{ type: "state", query: "ref:OCT-1", mode: "exists" }] },
    });
    expect(notified(() => h.call(c.watchCheck, { refs: [firing.ref] }))).toBe(1);
  });

  test("the sweep tells the dashboard, so that an agent that vanished stops being shown as waiting", () => {
    const watch = h.call(c.watchCreate, { spec: SPEC, ephemeral: true });
    h.setNow("2026-11-07T12:10:00.000Z");
    let statusAtNotification: string | undefined;
    h.tracker.subscribe(() => {
      statusAtNotification = h
        .call(c.watchList, { all: true })
        .find((item) => item.ref === watch.ref)?.status;
    });
    h.tracker.sweep();
    expect(statusAtNotification).toBe("expired");
  });
});
