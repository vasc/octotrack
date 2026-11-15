import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import { agentState } from "../src/agents/state.ts";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const START = "2026-11-14T09:00:00.000Z";
const MINUTE = 60_000;

/** Two checkouts of PANEL, one of GARDEN; GARDEN has no GitHub repo, so its agents say which repo they serve. */
const REMOTES: Readonly<Record<string, string>> = {
  "/src/homepanel": "vasc/homepanel",
  "/src/homepanel-2": "vasc/homepanel",
  "/src/octotrack": "vasc/octotrack",
};

function world() {
  let now = START;
  const tracker = new Tracker(memoryDriver(), () => now, {
    remoteOf: (checkout) => REMOTES[checkout] ?? null,
  });
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const agent = (name: string, checkout = "/src/homepanel"): Caller => ({
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
  function outcome(caller: Caller, name: string, input: unknown) {
    return tracker.execute(name, input, caller);
  }
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
  as(dev, c.projectCreate, { key: "OCT", name: "Octotrack", repo: "vasc/octotrack" });
  as(dev, c.projectCreate, { key: "GARDEN", name: "Garden" });
  const line = (title: string, where: "working" | "up_next" | "tabled", repos = ["PANEL"]) =>
    as(dev, c.lineAdd, {
      title,
      doneWhen: "Done.",
      repos,
      where,
      ...(where === "tabled" ? { reason: "Later" } : {}),
    });
  return {
    tracker,
    dev,
    agent,
    as,
    outcome,
    refusal,
    line,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
    now: () => now,
  };
}

describe("who an agent is: a name plus its checkout", () => {
  test("the first command registers it, with the repo read from the checkout's remote", () => {
    const w = world();
    const meals = w.agent("panel");
    w.as(meals, c.agentRegister, { wake: "screen:abc" });
    const [listed] = w.as(w.dev, c.agentList, {}).filter((agent) => agent.name === "panel");
    expect(listed).toMatchObject({
      name: "panel",
      repo: "PANEL",
      checkout: "/src/homepanel",
      wakeAddress: "screen:abc",
    });
    expect(listed?.state).toBe("running");
  });

  test("the same name from another checkout is refused with a free name, while the first is not gone", () => {
    const w = world();
    w.as(w.agent("panel"), c.agentRegister, {});
    const refused = w.refusal(() => w.as(w.agent("panel", "/src/homepanel-2"), c.agentRegister, {}));
    expect(refused.code).toBe("conflict");
    expect(refused.hint).toContain("panel.2");
  });

  test("a call with no name is the one agent that uses its checkout, and is refused otherwise", () => {
    const w = world();
    w.as(w.agent("panel"), c.agentRegister, {});
    const anonymous: Caller = { actor: "agent", channel: "cli", anonymous: true, checkout: "/src/homepanel" };
    expect(w.as(anonymous, c.agentNote, { note: "busy" }).name).toBe("panel");

    w.as(w.agent("panel-two"), c.agentRegister, {});
    expect(w.refusal(() => w.as(anonymous, c.agentNote, { note: "x" })).message).toContain(
      "two agents use this checkout",
    );
    const elsewhere: Caller = { ...anonymous, checkout: "/src/octotrack" };
    const unknown = w.refusal(() => w.as(elsewhere, c.agentNote, { note: "x" }));
    expect(unknown.message).toContain("set your agent name");
    expect(`${unknown.message} ${unknown.hint ?? ""}`).not.toContain("--me");
  });

  test("a name shaped like a ref is refused", () => {
    const w = world();
    expect(w.refusal(() => w.as(w.agent("GARDEN-2"), c.agentRegister, {})).code).toBe("invalid_input");
  });

  test("an agent whose checkout has no GitHub repo says which repo it serves", () => {
    const w = world();
    const garden = w.agent("garden", "/src/garden");
    expect(w.as(garden, c.agentRegister, { repo: "GARDEN" }).repo).toBe("GARDEN");
  });
});

describe("agent states", () => {
  const base = {
    name: "a",
    note: null,
    firstSeenAt: START,
    lastSeenAt: START,
    checkout: null,
    repo: null,
    wakeAddress: null,
    startedBy: null,
    stoppedAt: null,
    stoppedReason: null,
    goneAt: null,
    wokenAt: null,
    wakeError: null,
  };
  const at = (minutes: number) => new Date(Date.parse(START) + minutes * MINUTE).toISOString();

  test("running within 15 minutes of its last command, then asleep or quiet by whether it can be woken", () => {
    expect(agentState(base, at(14))).toBe("running");
    expect(agentState(base, at(16))).toBe("quiet");
    expect(agentState({ ...base, wakeAddress: "screen:x" }, at(16))).toBe("asleep");
  });

  test("gone and stopped override everything, and silence alone never makes an agent gone", () => {
    expect(agentState({ ...base, goneAt: at(1) }, at(2))).toBe("gone");
    expect(agentState({ ...base, stoppedAt: at(1), goneAt: at(1) }, at(2))).toBe("stopped");
    expect(agentState(base, at(60 * 24 * 30))).toBe("quiet");
  });
});

describe("taking a line", () => {
  test("bare take: owner of the highest working line in its repo, then helper where there is work, then scoper", () => {
    const w = world();
    const top = w.line("Sendspin enclosure", "working");
    w.line("Wall mount", "up_next");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Model the base", line: top.ref });

    const first = w.as(w.agent("one"), c.lineTake, {});
    expect([first.line?.ref, first.role]).toEqual([top.ref, "owner"]);
    const second = w.as(w.agent("two", "/src/homepanel-2"), c.lineTake, {});
    expect([second.line?.ref, second.role]).toEqual([top.ref, "helper"]);
    expect(second.next?.title).toBe("Model the base");

    w.as(w.agent("two", "/src/homepanel-2"), c.issueClaim, { refs: ["PANEL-1"] });
    const third = w.as(w.agent("three", "/src/homepanel"), c.lineTake, {});
    expect([third.line?.title, third.role]).toEqual(["Wall mount", "scoper"]);
  });

  test("take by ref is refused with why on a line it may not take, and that never counts", () => {
    const w = world();
    const tabled = w.line("Podcast cleanup", "tabled");
    const other = w.line("Octotrack itself", "working", ["OCT"]);
    const a = w.agent("one");
    expect(w.refusal(() => w.as(a, c.lineTake, { ref: tabled.ref })).message).toContain("tabled");
    expect(w.refusal(() => w.as(a, c.lineTake, { ref: other.ref })).message).toContain("PANEL");
    expect(w.as(w.dev, c.feedList, { query: "event:agent.would_stop" }).events).toEqual([]);
  });

  test("an owner with no work is told to break the step into issues or propose done, and keeps the line", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    w.as(w.dev, c.planSet, { line: line.ref, steps: ["Model the base", "Print"] });
    const a = w.agent("one");
    w.as(a, c.lineTake, {});
    const again = w.as(a, c.lineTake, {});
    expect(again.role).toBe("owner");
    expect(again.message).toContain("break step 1 into issues, or propose done");
  });

  test("an issue on a line is claimed only by an agent on that line", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Model the base", line: line.ref });
    const a = w.agent("one");
    expect(w.refusal(() => w.as(a, c.issueClaim, { refs: ["PANEL-1"] })).hint).toContain("octo line take");
    w.as(a, c.lineTake, { ref: line.ref });
    expect(w.as(a, c.issueClaim, { refs: ["PANEL-1"] })[0]?.assignee).toBe("one");
  });

  test("taking another line releases the first; when the owner leaves, a helper becomes owner with no search", () => {
    const w = world();
    const top = w.line("Sendspin enclosure", "working");
    const next = w.line("Wall mount", "working");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Work", line: top.ref });
    const one = w.agent("one");
    const two = w.agent("two", "/src/homepanel-2");
    w.as(one, c.lineTake, { ref: top.ref });
    w.as(two, c.lineTake, { ref: top.ref });
    w.as(one, c.lineTake, { ref: next.ref });
    const crew = w.as(w.dev, c.homeShow, {}).crews[top.ref];
    expect(crew?.owner?.name).toBe("two");
    const notices = w.outcome(two, c.agentList.name, {}).notices.map((notice) => notice.kind);
    expect(notices).toContain("promoted");
  });
});

describe("stopping an agent", () => {
  test("ends its claims, refuses its writes until lifted, and tells it without waking it", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    const a = w.agent("one");
    w.as(a, c.agentRegister, { wake: "screen:abc" });
    w.as(a, c.lineTake, { ref: line.ref });
    w.as(w.dev, c.agentStop, { name: "one", reason: "Wrong approach" });
    expect(w.as(w.dev, c.homeShow, {}).crews[line.ref]?.owner).toBeNull();
    const refused = w.refusal(() => w.as(a, c.agentNote, { note: "still here" }));
    expect(refused.code).toBe("forbidden");
    const notices = w.outcome(a, c.agentList.name, {}).notices;
    expect(notices.map((notice) => [notice.kind, notice.wakes])).toEqual([["stop", false]]);
    expect(w.refusal(() => w.as(a, c.agentLift, { name: "one" })).code).toBe("forbidden");
    w.as(w.dev, c.agentLift, { name: "one" });
    expect(w.as(a, c.agentNote, { note: "back" }).note).toBe("back");
  });
});

describe("what agents may write depends on the line's state", () => {
  test("a working line moved away gives its crew 15 minutes to wind down, then writes there are refused", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Model the base", line: line.ref });
    const a = w.agent("one");
    w.as(a, c.lineTake, { ref: line.ref });
    w.as(w.dev, c.lineTable, { ref: line.ref, reason: "Waiting on the board" });
    const notices = w.outcome(a, c.agentList.name, {}).notices;
    expect(notices.map((notice) => [notice.kind, notice.wakes])).toEqual([["wind_down", true]]);
    w.as(a, c.issueUpdate, { refs: ["PANEL-1"], body: "Hand-off: the base is modelled to 26 mm." });

    w.later(16);
    for (const body of ["one", "two"]) {
      expect(w.refusal(() => w.as(a, c.issueUpdate, { refs: ["PANEL-1"], body })).code).toBe("forbidden");
    }
    expect(w.as(w.dev, c.feedList, { query: "event:agent.would_stop" }).events).toEqual([]);
    w.refusal(() => w.as(a, c.issueUpdate, { refs: ["PANEL-1"], body: "three" }));
    // Record only, for now: the automatic Stop says what it would have done and does not stop.
    expect(w.as(w.dev, c.feedList, { query: "event:agent.would_stop" }).events).toHaveLength(1);
    expect(w.as(w.dev, c.feedList, { query: "event:write.refused" }).events).toHaveLength(3);
    expect(w.as(a, c.agentNote, { note: "fine" }).note).toBe("fine");
  });

  test("an up-next line takes scoping from its scoper, refuses claims, and the scoper owns it when it starts", () => {
    const w = world();
    const line = w.line("Wall mount", "up_next");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Measure the wall", line: line.ref });
    const a = w.agent("one");
    const taken = w.as(a, c.lineTake, { ref: line.ref });
    expect(taken.role).toBe("scoper");
    w.as(a, c.planSet, { line: line.ref, steps: ["Measure", "Model"] });
    expect(w.refusal(() => w.as(a, c.issueClaim, { refs: ["PANEL-1"] })).code).toBe("forbidden");
    const other = w.agent("two", "/src/homepanel-2");
    expect(w.refusal(() => w.as(other, c.planSet, { line: line.ref, steps: ["Mine"] })).code).toBe(
      "forbidden",
    );

    w.as(w.dev, c.lineStart, { ref: line.ref });
    expect(w.as(w.dev, c.homeShow, {}).crews[line.ref]?.owner?.name).toBe("one");
  });

  test("a scoper that releases a line with a done when and a plan leaves it scoped", () => {
    const w = world();
    const line = w.line("Wall mount", "up_next");
    const a = w.agent("one");
    w.as(a, c.lineTake, { ref: line.ref });
    w.as(a, c.planSet, { line: line.ref, steps: ["Measure"] });
    w.as(a, c.lineRelease, {});
    expect(w.as(w.dev, c.lineShow, { ref: line.ref }).line.scopedAt).not.toBeNull();
    expect(w.refusal(() => w.as(a, c.lineTake, { ref: line.ref })).message).toContain("scoped");
  });
});

describe("every working line gets an owner", () => {
  test("idle agents with the repo are offered a line that needs an owner in their replies, until one takes it", () => {
    const w = world();
    const a = w.agent("one");
    w.as(a, c.agentRegister, {});
    const line = w.line("Sendspin enclosure", "working");
    w.later(1);
    const offered = w.outcome(a, c.agentList.name, {}).notices;
    expect(offered.map((notice) => notice.kind)).toEqual(["needs_owner"]);
    expect(offered[0]?.body).toContain(`octo line take ${line.ref}`);
    w.as(a, c.lineTake, { ref: line.ref });
    expect(w.outcome(a, c.agentList.name, {}).notices).toEqual([]);
  });

  test("the last owner is offered the line first when it starts again, and only it, for 10 minutes", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    const one = w.agent("one");
    const two = w.agent("two", "/src/homepanel-2");
    w.as(one, c.agentRegister, { wake: "screen:one" });
    w.as(two, c.agentRegister, {});
    w.as(one, c.lineTake, { ref: line.ref });
    w.as(w.dev, c.lineQueue, { ref: line.ref });
    w.later(20);
    w.as(w.dev, c.lineStart, { ref: line.ref });
    const first = w.outcome(one, c.agentList.name, {}).notices;
    // The wind-down notice from when the line was queued is still waiting for this agent's next reply too.
    expect(first.map((notice) => [notice.kind, notice.wakes])).toEqual([
      ["wind_down", true],
      ["owner_offer", true],
    ]);
    expect(w.outcome(two, c.agentList.name, {}).notices).toEqual([]);
    w.later(11);
    expect(w.outcome(two, c.agentList.name, {}).notices.map((notice) => notice.kind)).toEqual([
      "needs_owner",
    ]);
  });

  test("home says when a working line needs the developer to step in", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    expect(w.as(w.dev, c.homeShow, {}).crews[line.ref]?.search?.step).toBe(2);
    w.later(1);
    expect(w.as(w.dev, c.homeShow, {}).crews[line.ref]?.search?.step).toBe(3);
  });
});

describe("dates and deadlines", () => {
  test("a tabled line comes back under Proposed on its look-again date, with the developer's own reason", () => {
    const w = world();
    const line = w.line("Podcast cleanup", "working", []);
    w.as(w.dev, c.lineTable, { ref: line.ref, reason: "The disk is not tight", lookAgainAt: "2026-11-15" });
    w.later(60 * 24);
    w.tracker.sweep();
    const back = w.as(w.dev, c.homeShow, {}).proposed.find((item) => item.ref === line.ref);
    expect(back?.tabledReason).toBe("The disk is not tight");
  });

  test("at the end of a Done line's wind-down its open issues close with it", () => {
    const w = world();
    const line = w.line("Sendspin enclosure", "working");
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Leftover", line: line.ref });
    w.as(w.dev, c.lineDone, { ref: line.ref });
    w.later(16);
    w.tracker.sweep();
    expect(w.as(w.dev, c.issueList, { query: "ref:PANEL-1" })[0]?.issue.status).toBe("cancelled");
  });
});
