import { beforeEach, describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import type { WatchSpec } from "../src/schemas.ts";
import { type Harness, harness } from "./helpers.ts";

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

function execute(name: string, input: unknown): void {
  h.tracker.execute(name, input, h.as);
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
  h.call(c.ideaCapture, { title: "An idea", project: "OCT" });
  h.call(c.milestoneCreate, { project: "OCT", title: "A milestone" });
  h.call(c.viewSave, { name: "Mine", query: "kind:issue" });
  h.call(c.watchCreate, { spec: SPEC, name: "registered" });
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
  ["decision.wake", { ref: "D-1", address: "test:s" }],
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
  ["idea.capture", { title: "New" }],
  ["idea.update", { ref: "I-1", horizon: "next" }],
  ["idea.promote", { ref: "I-1" }],
  ["milestone.create", { project: "OCT", title: "New" }],
  ["milestone.update", { ref: "M-1", status: "active" }],
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
];

describe("every write reaches the dashboard", () => {
  test("every writing operation is covered here, apart from polling, which has its own rules", () => {
    const covered = new Set(EVERY_WRITE.map(([name]) => name));
    const missing = Object.values(c)
      .filter((contract) => contract.mutates && contract.name !== c.watchCheck.name)
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
    expect(notified(() => h.call(c.prSync, { prs: [pr] }))).toBe(1);
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
