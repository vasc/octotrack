import { beforeEach, describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import type { WatchSpec } from "../src/schemas.ts";
import { type Harness, harness } from "./helpers.ts";

let h: Harness;

function spec(partial: {
  on?: string[];
  until?: string[];
  none?: string[];
  require?: "any" | "all";
}): WatchSpec {
  return {
    require: partial.require ?? "any",
    clauses: [
      ...(partial.on ?? []).map((query) => ({ type: "event" as const, query, count: 1 })),
      ...(partial.until ?? []).map((query) => ({ type: "state" as const, query, mode: "exists" as const })),
      ...(partial.none ?? []).map((query) => ({ type: "state" as const, query, mode: "none" as const })),
    ],
  };
}

function check(ref: string) {
  const [result] = h.call(c.watchCheck, { refs: [ref] });
  if (result === undefined) throw new Error("no result");
  return result;
}

beforeEach(() => {
  h = harness();
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack" });
});

describe("watches", () => {
  test("a state clause cannot miss a decision made before the watch started", () => {
    const decision = h.call(c.decisionAsk, { title: "Q" });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    const watch = h.call(c.watchCreate, { spec: spec({ until: [`ref:${decision.ref} status:decided`] }) });
    const result = check(watch.ref);
    expect(result.fired).toBe(true);
    expect(result.clauses[0]?.entities[0]?.ref).toBe(decision.ref);
  });

  test("an event clause fires only on new matching events", () => {
    const decision = h.call(c.decisionAsk, { title: "Q" });
    const watch = h.call(c.watchCreate, { spec: spec({ on: ["event:decision.resolved"] }) });
    expect(check(watch.ref).fired).toBe(false);
    h.call(c.issueCreate, { project: "OCT", title: "Noise" });
    expect(check(watch.ref).fired).toBe(false);
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    const result = check(watch.ref);
    expect(result.fired).toBe(true);
    expect(result.clauses[0]?.events[0]?.ref).toBe(decision.ref);
  });

  test("until-none waits until everything is resolved", () => {
    const first = h.call(c.decisionAsk, { title: "One" });
    const second = h.call(c.decisionAsk, { title: "Two" });
    const watch = h.call(c.watchCreate, {
      spec: spec({ none: [`ref:${first.ref},${second.ref} status:open`] }),
    });
    expect(check(watch.ref).fired).toBe(false);
    h.call(c.decisionResolve, { ref: first.ref, note: "Yes" });
    expect(check(watch.ref).fired).toBe(false);
    h.call(c.decisionResolve, { ref: second.ref, note: "Yes" });
    expect(check(watch.ref).fired).toBe(true);
  });

  test("any fires on the first clause, all needs every clause", () => {
    const decision = h.call(c.decisionAsk, { title: "Q" });
    const any = h.call(c.watchCreate, {
      spec: spec({ on: ["event:pr.merged"], until: [`ref:${decision.ref} status:decided`] }),
    });
    const all = h.call(c.watchCreate, {
      spec: spec({ on: ["event:pr.merged"], until: [`ref:${decision.ref} status:decided`], require: "all" }),
    });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    expect(check(any.ref).fired).toBe(true);
    expect(check(all.ref).fired).toBe(false);
    h.call(c.prUpsert, { repo: "a/b", number: 1, title: "x", state: "merged" });
    expect(check(all.ref).fired).toBe(true);
  });

  test("with all, an event seen early is not forgotten", () => {
    const decision = h.call(c.decisionAsk, { title: "Q" });
    const all = h.call(c.watchCreate, {
      spec: spec({ on: ["event:pr.merged"], until: [`ref:${decision.ref} status:decided`], require: "all" }),
    });
    h.call(c.prUpsert, { repo: "a/b", number: 1, title: "x", state: "merged" });
    expect(check(all.ref).fired).toBe(false);
    h.call(c.issueCreate, { project: "OCT", title: "Noise" });
    expect(check(all.ref).fired).toBe(false);
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    expect(check(all.ref).fired).toBe(true);
  });

  test("count needs that many events, across several checks", () => {
    const watch = h.call(c.watchCreate, {
      spec: { require: "any", clauses: [{ type: "event", query: "event:issue.created", count: 2 }] },
    });
    h.call(c.issueCreate, { project: "OCT", title: "One" });
    expect(check(watch.ref).fired).toBe(false);
    h.call(c.issueCreate, { project: "OCT", title: "Two" });
    expect(check(watch.ref).fired).toBe(true);
  });

  test("a fired watch stays fired, a following watch keeps going", () => {
    const once = h.call(c.watchCreate, { spec: spec({ on: ["event:issue.created"] }) });
    const follow = h.call(c.watchCreate, { spec: spec({ on: ["event:issue.created"] }), follow: true });
    h.call(c.issueCreate, { project: "OCT", title: "One" });
    expect(check(once.ref).fired).toBe(true);
    expect(check(follow.ref).fired).toBe(true);
    expect(h.call(c.watchList, { all: true }).find((watch) => watch.ref === once.ref)?.status).toBe("fired");
    expect(check(follow.ref).fired).toBe(false);
    h.call(c.issueCreate, { project: "OCT", title: "Two" });
    expect(check(follow.ref).clauses[0]?.events).toHaveLength(1);
  });

  test("following a state clause is refused, since it would fire forever", () => {
    expect(() => h.call(c.watchCreate, { spec: spec({ until: ["kind:issue"] }), follow: true })).toThrow(
      "--on",
    );
  });

  test("watching a ref that does not exist fails instead of firing", () => {
    expect(() => h.call(c.watchCreate, { spec: spec({ none: ["ref:D-99 status:open"] }) })).toThrow("D-99");
  });

  test("named watches are reachable by name and per agent", () => {
    h.call(c.watchCreate, { spec: spec({ on: ["kind:issue"] }), name: "mine" });
    h.call(c.watchCreate, { spec: spec({ on: ["kind:issue"] }), name: "mine" }, "agent-b");
    expect(() => h.call(c.watchCreate, { spec: spec({ on: ["kind:issue"] }), name: "mine" })).toThrow(
      "already has",
    );
    expect(h.call(c.watchList, { agent: "agent-b" })).toHaveLength(1);
    h.call(c.watchCancel, { refs: ["mine"] });
    expect(h.call(c.watchList, { agent: "agent-a" })).toHaveLength(0);
    expect(h.call(c.watchList, { agent: "agent-b" })).toHaveLength(1);
  });

  test("a live waiter raises a decision in the queue, and stops counting once it goes quiet", () => {
    const quiet = h.call(c.decisionAsk, { title: "Nobody waiting", priority: "medium" });
    const waited = h.call(c.decisionAsk, { title: "Someone waiting", priority: "medium" });
    h.call(c.watchCreate, { spec: spec({ until: [`ref:${waited.ref} status:decided`] }), ephemeral: true });

    const [top] = h.call(c.decisionQueue, {});
    expect(top?.decision.ref).toBe(waited.ref);
    expect(top?.waiters).toEqual(["agent-a"]);
    expect(top?.reasons).toContain("1 agent waiting");

    h.setNow("2026-11-07T12:05:00.000Z");
    const later = h.call(c.decisionQueue, {});
    expect(later.find((card) => card.decision.ref === waited.ref)?.waiters).toEqual([]);
    expect(later.map((card) => card.decision.ref)).toContain(quiet.ref);
  });

  test("a registered watch is not waiting until it is polled, then stops counting when polling stops", () => {
    const decision = h.call(c.decisionAsk, { title: "Q" });
    h.call(c.watchCreate, { spec: spec({ until: [`ref:${decision.ref} status:decided`] }), name: "later" });
    const waitersNow = () => h.call(c.decisionQueue, {})[0]?.waiters;
    expect(waitersNow()).toEqual([]);

    check("later");
    expect(waitersNow()).toEqual(["agent-a"]);

    h.setNow("2026-11-07T12:05:00.000Z");
    expect(waitersNow()).toEqual([]);
  });

  test("abandoned one-shot watches expire on sweep, and come back if their owner turns out to be alive", () => {
    const watch = h.call(c.watchCreate, { spec: spec({ on: ["kind:issue"] }), ephemeral: true });
    h.setNow("2026-11-07T12:10:00.000Z");
    h.tracker.sweep();
    expect(h.call(c.watchList, { all: true }).find((item) => item.ref === watch.ref)?.status).toBe("expired");
    expect(check(watch.ref).fired).toBe(false);
    expect(h.call(c.watchList, { all: false }).map((item) => item.ref)).toEqual([watch.ref]);
  });

  test("a fired watch keeps reporting what it saw", () => {
    const watch = h.call(c.watchCreate, { spec: spec({ on: ["kind:issue"] }), name: "later" });
    h.call(c.issueCreate, { project: "OCT", title: "One" });
    expect(check("later").clauses[0]?.events).toHaveLength(1);
    expect(check(watch.ref).clauses[0]?.events[0]?.ref).toBe("OCT-1");
  });

  test("polling a cancelled watch is an error, not an endless hang", () => {
    const watch = h.call(c.watchCreate, { spec: spec({ on: ["kind:issue"] }) });
    h.call(c.watchCancel, { refs: [watch.ref] });
    expect(() => check(watch.ref)).toThrow("cancelled");
  });
});
