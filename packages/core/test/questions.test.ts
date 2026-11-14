import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const START = "2026-11-14T09:00:00.000Z";
const MINUTE = 60_000;

const OPTIONS = [
  { key: "a", label: "26 mm", description: "Print the base as it is; the 30 mm board will not fit." },
  { key: "b", label: "30 mm", description: "Rebuild the model first, a day's work." },
];
const SITUATION =
  "The base is printed for the 26 mm board. The 30 mm board has the better antenna but needs a new model.";

function world() {
  let now = START;
  const tracker = new Tracker(memoryDriver(), () => now, {
    remoteOf: (checkout) => (checkout.startsWith("/src/panel") ? "vasc/homepanel" : null),
  });
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const agent = (name: string, checkout = `/src/panel-${name}`): Caller => ({
    actor: name,
    channel: "cli",
    checkout,
  });
  function as<I extends z.ZodType, O extends z.ZodType>(
    caller: Caller,
    contract: Contract<I, O>,
    input: z.input<I>,
  ) {
    return tracker.call(contract, input, caller);
  }
  const notices = (caller: Caller) => tracker.execute(c.agentList.name, {}, caller).notices;
  function refusal(run: () => unknown): OctoError {
    try {
      run();
    } catch (error) {
      if (error instanceof OctoError) return error;
      throw error;
    }
    throw new Error("expected a refusal");
  }
  as(dev, c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
  const line = (title: string, where: "working" | "up_next" = "working") =>
    as(dev, c.lineAdd, { title, doneWhen: "Done.", repos: ["PANEL"], where });
  return {
    tracker,
    dev,
    agent,
    as,
    notices,
    refusal,
    line,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
  };
}

/** A line with an owner holding an issue on it. */
function ownedLine() {
  const w = world();
  const line = w.line("Sendspin enclosure");
  w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Pick the board", line: line.ref });
  const owner = w.agent("panel");
  w.as(owner, c.agentRegister, { wake: "claude:panel" });
  w.as(owner, c.lineTake, { ref: line.ref });
  w.as(owner, c.issueClaim, { refs: ["PANEL-1"] });
  return { ...w, ref: line.ref, owner };
}

describe("a question stands alone", () => {
  test("asked from a line, it belongs to that line and to the issue the asker holds", () => {
    const w = ownedLine();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board goes in?",
      context: SITUATION,
      options: OPTIONS,
      recommendation: "a",
      why: "The antenna gain does not matter at two metres.",
    });
    expect([asked.line, asked.issue]).toEqual([w.ref, "PANEL-1"]);
    expect(asked.recommendationWhy).toBe("The antenna gain does not matter at two metres.");
  });

  test("it needs a situation, options that say what happens, and a reason for any recommendation", () => {
    const w = ownedLine();
    const base = { title: "Which board goes in?", context: SITUATION, options: OPTIONS };
    expect(w.refusal(() => w.as(w.owner, c.decisionAsk, { ...base, context: " " })).message).toContain(
      "situation",
    );
    const bare = OPTIONS.map(({ key, label }) => ({ key, label }));
    expect(w.refusal(() => w.as(w.owner, c.decisionAsk, { ...base, options: bare })).message).toContain(
      "what happens",
    );
    expect(w.refusal(() => w.as(w.owner, c.decisionAsk, { ...base, recommendation: "a" })).message).toContain(
      "why",
    );
  });

  test("urgent only on a working line, and only for a reason from the fixed set", () => {
    const w = ownedLine();
    const urgent = w.as(w.owner, c.decisionAsk, {
      title: "Order the boards today?",
      context: SITUATION,
      options: OPTIONS,
      urgent: "time_boxed",
    });
    expect(urgent.urgentReason).toBe("time_boxed");
    w.as(w.dev, c.decisionNotUrgent, { ref: urgent.ref });
    expect(w.notices(w.owner).map((notice) => [notice.kind, notice.wakes])).toEqual([["not_urgent", false]]);
    expect(w.as(w.dev, c.feedList, { query: "event:decision.not_urgent" }).events).toHaveLength(1);
  });
});

describe("the line inbox", () => {
  test("an answer goes to whoever holds the issue it concerns, once, on its next reply", () => {
    const w = ownedLine();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.as(w.dev, c.decisionResolve, { ref: asked.ref, option: "b", note: "Antenna matters in the garage." });
    const delivered = w.notices(w.owner);
    expect(delivered.map((notice) => notice.kind)).toEqual(["answer"]);
    expect(delivered[0]?.body).toContain(asked.ref);
    expect(delivered[0]?.body).toContain("30 mm");
    expect(w.notices(w.owner)).toEqual([]);
  });

  test("with nobody on the line, the answer waits, and whoever takes the line hears it", () => {
    const w = ownedLine();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.as(w.owner, c.issueRelease, { refs: ["PANEL-1"] });
    w.as(w.owner, c.lineRelease, {});
    w.notices(w.owner);
    w.as(w.dev, c.decisionResolve, { ref: asked.ref, option: "a" });
    // It hears that the line needs an owner, but not the answer: that is for whoever is on the line.
    expect(w.notices(w.owner).map((notice) => notice.kind)).toEqual(["needs_owner"]);
    const next = w.agent("panel.2");
    const taken = w.tracker.execute(c.lineTake.name, { ref: w.ref }, next);
    expect(taken.notices.map((notice) => notice.kind)).toEqual(["answer"]);
  });

  test("a Tell goes to the owner, or into the inbox for whoever holds the issue it names; an empty one is a nudge", () => {
    const w = ownedLine();
    w.as(w.dev, c.lineTell, { line: w.ref, body: "Use the white filament." });
    w.as(w.dev, c.lineTell, { line: w.ref, body: "", issue: "PANEL-1" });
    const heard = w.notices(w.owner);
    expect(heard.map((notice) => notice.kind)).toEqual(["tell", "tell"]);
    expect(heard[0]?.body).toContain("Use the white filament.");
    expect(heard[1]?.body).toContain("nudge");
  });

  test("an asleep agent with something waiting is woken by its own address; a failed wake makes it gone", () => {
    const w = ownedLine();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.later(20);
    w.as(w.dev, c.decisionResolve, { ref: asked.ref, option: "a" });
    const due = w.as(w.dev, c.agentWakes, {});
    expect(due.map((wake) => [wake.agent, wake.address])).toEqual([["panel", "claude:panel"]]);
    expect(due[0]?.message).not.toContain("26 mm");

    w.as({ actor: "octotrack", channel: "cli", system: true }, c.agentWoken, {
      name: "panel",
      error: "Exit 1: not logged in",
    });
    expect(w.as(w.dev, c.agentWakes, {})).toEqual([]);
    const listed = w.as(w.dev, c.agentList, {}).find((agent) => agent.name === "panel");
    expect([listed?.state, listed?.line]).toEqual(["gone", null]);
    const taken = w.tracker.execute(c.lineTake.name, { ref: w.ref }, w.agent("panel.2"));
    expect(taken.notices.map((notice) => notice.kind)).toEqual(["answer"]);
  });

  test("a running agent is not woken: its next reply carries the answer", () => {
    const w = ownedLine();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.as(w.dev, c.decisionResolve, { ref: asked.ref, option: "a" });
    expect(w.as(w.dev, c.agentWakes, {})).toEqual([]);
  });
});

describe("what reaches the developer follows the line order", () => {
  test("questions in line order, urgent first, Later at the bottom of its own line, held lines left out", () => {
    const w = world();
    const first = w.line("First line");
    const second = w.line("Second line");
    const waiting = w.line("Up next line", "up_next");
    const ask = (name: string, line: string, title: string, extra: Record<string, unknown> = {}) => {
      const caller = w.agent(name);
      w.as(caller, c.lineTake, { ref: line });
      return w.as(caller, c.decisionAsk, { title, context: SITUATION, options: OPTIONS, ...extra });
    };
    const later = ask("one", first.ref, "First, later");
    ask("one", first.ref, "First, plain");
    ask("two", second.ref, "Second, plain");
    ask("three", second.ref, "Second, urgent", { urgent: "costs_money" });
    ask("four", waiting.ref, "Held");
    w.as(w.dev, c.decisionPostpone, { ref: later.ref });
    w.as(w.dev, c.lineOrder, { ref: second.ref, to: "top" });
    const titles = w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.title);
    expect(titles).toEqual(["Second, urgent", "Second, plain", "First, plain", "First, later"]);
  });
});

describe("drift asks agents to place work that is on no line", () => {
  test("one drift per repo, which goes once every open issue there is on a line", () => {
    const w = world();
    const line = w.line("Sendspin enclosure");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Loose one" });
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Loose two" });
    const open = () => w.as(w.dev, c.driftList, { query: "rule:unplaced-work status:open" });
    expect(open().map((drift) => [drift.target, drift.message])).toEqual([
      ["PANEL", "2 open issues in PANEL are on no line"],
    ]);
    w.as(w.dev, c.issueUpdate, { refs: ["PANEL-1", "PANEL-2"], line: line.ref });
    w.as(w.dev, c.driftScan, {});
    expect(open()).toEqual([]);
  });
});
