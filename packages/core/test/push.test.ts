import { describe, expect, test } from "bun:test";
import { shouldBuzz } from "../src/push/buzz.ts";
import { contracts as c } from "../src/contracts.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const OPTIONS = [{ key: "a", label: "Yes", description: "Go ahead." }];

describe("what buzzes the phone", () => {
  test("urgent always; the top two lines once until the app is opened again; anything else never", () => {
    const base = {
      urgent: false,
      lineIndex: 0,
      lineBuzzedAt: null,
      lastOpenedAt: "2026-11-14T09:00:00.000Z",
    };
    expect(
      shouldBuzz({ ...base, urgent: true, lineIndex: 7, lineBuzzedAt: "2026-11-14T10:00:00.000Z" }),
    ).toBe(true);
    expect(shouldBuzz(base)).toBe(true);
    expect(shouldBuzz({ ...base, lineIndex: 1 })).toBe(true);
    expect(shouldBuzz({ ...base, lineIndex: 2 })).toBe(false);
    expect(shouldBuzz({ ...base, lineBuzzedAt: "2026-11-14T10:00:00.000Z" })).toBe(false);
    expect(shouldBuzz({ ...base, lineBuzzedAt: "2026-11-14T08:00:00.000Z" })).toBe(true);
  });
});

function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const tracker = new Tracker(memoryDriver(), () => now);
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const server: Caller = { actor: "octotrack", channel: "cli", system: true };
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel" }, dev);
  const lines = ["First", "Second", "Third"].map((title) =>
    tracker.call(c.lineAdd, { title, doneWhen: "Done.", repos: ["PANEL"], where: "working" }, dev),
  );
  tracker.call(c.runnerReport, { configured: true, cap: 0, dryRun: false }, server);
  const ask = (line: string, title: string, urgent = false) => {
    const agent: Caller = { actor: `agent.${line}`, channel: "cli" };
    tracker.call(c.agentRegister, { repo: "PANEL" }, agent);
    tracker.call(c.lineTake, { ref: line }, agent);
    return tracker.call(
      c.decisionAsk,
      { title, context: "Context.", options: OPTIONS, ...(urgent ? { urgent: "broken" as const } : {}) },
      agent,
    );
  };
  return {
    tracker,
    dev,
    server,
    lines,
    ask,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * 60_000).toISOString();
    },
  };
}

describe("push notifications", () => {
  test("a question on a top line buzzes once, with its recommendation, and opens focused", () => {
    const w = world();
    const asked = w.ask("L-1", "Which board?");
    w.ask("L-3", "Not on a top line");
    const due = w.tracker.call(c.pushDue, {}, w.server);
    // As designed: the question is the title; the line and the recommendation come under it.
    expect(due.map((note) => [note.title, note.body, note.url])).toEqual([
      ["Which board?", "Line 1, First · Context.", `/?focus=${asked.ref}`],
    ]);
    w.tracker.call(c.pushSent, { keys: due.map((note) => note.key) }, w.server);
    w.ask("L-1", "Another on the same line");
    expect(w.tracker.call(c.pushDue, {}, w.server)).toEqual([]);
    w.tracker.call(c.pushSeen, {}, w.dev);
    // Second has no owner, so by now it asks the developer to step in too; this is about First.
    w.later(1);
    const again = w.tracker.call(c.pushDue, {}, w.server).map((note) => note.title);
    expect(again.filter((title) => !title.startsWith("Step in"))).toEqual(["Another on the same line"]);
  });

  test("urgent always buzzes, even on a line that just did", () => {
    const w = world();
    w.ask("L-3", "Order now?", true);
    const due = w.tracker.call(c.pushDue, {}, w.server);
    expect(due.map((note) => [note.title, note.body])).toEqual([
      ["Order now?", "Urgent, something broken · Line 3, Third · Context."],
    ]);
  });

  test("a top line that needs the developer to step in buzzes too", () => {
    const w = world();
    w.later(1);
    const due = w.tracker.call(c.pushDue, {}, w.server);
    expect(due.map((note) => note.title)).toEqual(["Step in: First", "Step in: Second"]);
  });

  test("subscriptions are the developer's, and kept until the push service says they are gone", () => {
    const w = world();
    const subscription = { endpoint: "https://push.example/abc", keys: { p256dh: "key", auth: "secret" } };
    w.tracker.call(c.pushSubscribe, subscription, w.dev);
    expect(w.tracker.call(c.pushSubscriptions, {}, w.server)).toEqual([subscription]);
    expect(() =>
      w.tracker.call(c.pushSubscribe, subscription, { actor: "agent-a", channel: "cli" }),
    ).toThrow();
    w.tracker.call(c.pushUnsubscribe, { endpoint: subscription.endpoint }, w.server);
    expect(w.tracker.call(c.pushSubscriptions, {}, w.server)).toEqual([]);
  });
});
