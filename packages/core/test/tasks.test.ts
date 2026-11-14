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
const DAY = 24 * 60;
const SITUATION = "The base is printed for the 26 mm board; the 30 mm one needs a new model.";
const OPTIONS = [
  { key: "a", label: "26 mm", description: "Print as it is." },
  { key: "b", label: "30 mm", description: "Remodel first, a day's work." },
];

function world() {
  let now = START;
  const tracker = new Tracker(memoryDriver(), () => now, {
    remoteOf: (checkout) => (checkout.startsWith("/src/panel") ? "vasc/homepanel" : null),
  });
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const agent = (name: string): Caller => ({ actor: name, channel: "cli", checkout: `/src/panel-${name}` });
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
  as(dev, c.placeAdd, { name: "the bench" });
  as(dev, c.placeAdd, { name: "the Mac" });
  const line = as(dev, c.lineAdd, {
    title: "Sendspin enclosure",
    doneWhen: "It holds the board.",
    repos: ["PANEL"],
    where: "working",
  });
  as(dev, c.issueCreate, { project: "PANEL", title: "Model the base", line: line.ref });
  const owner = agent("panel");
  as(owner, c.agentRegister, { wake: "claude:panel" });
  as(owner, c.lineTake, { ref: line.ref });
  as(owner, c.issueClaim, { refs: ["PANEL-1"] });
  notices(owner);
  return {
    tracker,
    dev,
    agent,
    as,
    notices,
    refusal,
    line: line.ref,
    owner,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
  };
}

describe("tasks: what only the developer can do", () => {
  test("a task has a place from the developer's list, an outcome to report, and frees the issue its filer holds", () => {
    const w = world();
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "The five numbers the model assumes, in mm.",
    });
    expect([task.assignee, task.place, task.line]).toEqual(["dev", "the bench", w.line]);
    expect(
      w.as(w.dev, c.entityShow, { ref: task.ref }).links.map((link) => [link.fromRef, link.rel, link.toRef]),
    ).toContainEqual([task.ref, "blocks", "PANEL-1"]);
    expect(
      w.refusal(() => w.as(w.owner, c.taskFile, { title: "x", place: "the garage", outcome: "y" })).hint,
    ).toContain("the bench");
  });

  test("Done sends the outcome to whoever holds the freed issue; Can't do it sends why and closes it as not done", () => {
    const w = world();
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "Numbers.",
    });
    w.as(w.dev, c.taskDone, { ref: task.ref, result: "41, 38, 12, 6, 3" });
    const heard = w.notices(w.owner);
    expect(heard.map((notice) => notice.kind)).toEqual(["task_done"]);
    expect(heard[0]?.body).toContain("41, 38, 12, 6, 3");
    const other = w.as(w.owner, c.taskFile, {
      title: "Test-fit",
      place: "the bench",
      outcome: "Fits or not.",
    });
    w.as(w.dev, c.taskCant, { ref: other.ref, why: "The printer is broken." });
    expect(w.notices(w.owner).map((notice) => notice.kind)).toEqual(["task_cant"]);
    expect(w.as(w.dev, c.issueList, { query: `ref:${other.ref}` })[0]?.issue.status).toBe("cancelled");
  });

  test("places are the developer's own list", () => {
    const w = world();
    expect(w.as(w.dev, c.placeList, {}).map((place) => place.name)).toEqual(["the bench", "the Mac"]);
    expect(w.refusal(() => w.as(w.owner, c.placeAdd, { name: "the garage" })).code).toBe("forbidden");
    w.as(w.dev, c.placeRemove, { name: "the Mac" });
    expect(w.as(w.dev, c.placeList, {}).map((place) => place.name)).toEqual(["the bench"]);
  });

  test("a question a task would settle waits behind it, and comes back if the task does not settle it", () => {
    const w = world();
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "Numbers.",
    });
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
      waitsFor: task.ref,
    });
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([]);
    w.as(w.dev, c.taskDone, { ref: task.ref, result: "41 mm" });
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([asked.ref]);
  });
});

describe("held work on lines not being worked on", () => {
  test("is current for 7 days after it was asked or re-confirmed, and the next scoper re-confirms the rest", () => {
    const w = world();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.as(w.dev, c.lineQueue, { ref: w.line });
    let held = w.as(w.dev, c.heldList, { line: w.line });
    expect(held.map((item) => [item.ref, item.current])).toEqual([[asked.ref, true]]);
    w.later(8 * DAY);
    held = w.as(w.dev, c.heldList, { line: w.line });
    expect(held.map((item) => [item.ref, item.current])).toEqual([[asked.ref, false]]);

    const scoper = w.agent("garden");
    w.as(scoper, c.agentRegister, { repo: "PANEL" });
    const taken = w.tracker.execute(c.lineTake.name, { ref: w.line }, scoper);
    expect(taken.notices.map((notice) => notice.body).join(" ")).toContain(
      `re-confirm or withdraw: ${asked.ref}`,
    );
    w.as(scoper, c.heldConfirm, { refs: [asked.ref] });
    expect(w.as(w.dev, c.heldList, { line: w.line })[0]?.current).toBe(true);
  });
});

describe("summaries stay true", () => {
  test("fall due an hour after significant work, as drift for the owner, and clear when rewritten", () => {
    const w = world();
    w.as(w.owner, c.issueUpdate, { refs: ["PANEL-1"], status: "done" });
    const due = () => w.as(w.dev, c.driftList, { query: "rule:summary-due status:open" });
    expect(due()).toEqual([]);
    w.later(61);
    w.tracker.sweep();
    expect(due().map((drift) => [drift.target, drift.assignee])).toEqual([[w.line, "panel"]]);
    expect(
      w.refusal(() => w.as(w.agent("helper"), c.lineSummarize, { ref: w.line, headline: "x", summary: "y" }))
        .code,
    ).toBe("forbidden");
    w.as(w.owner, c.lineSummarize, {
      ref: w.line,
      headline: "The base is modelled; the board choice is next.",
      summary: "## Where it stands\n\nThe base is modelled to 26 mm.",
    });
    w.tracker.sweep();
    expect(due()).toEqual([]);
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.headline).toBe(
      "The base is modelled; the board choice is next.",
    );
  });
});

describe("done when and done are the developer's to accept", () => {
  test("an owner proposes a new done when, and the developer accepts or keeps the old one", () => {
    const w = world();
    w.as(w.owner, c.lineDoneWhen, { ref: w.line, doneWhen: "It holds the board and the USB-C plug." });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneWhen).toBe("It holds the board.");
    w.as(w.dev, c.lineDoneWhenAnswer, { ref: w.line, accept: true });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneWhen).toBe(
      "It holds the board and the USB-C plug.",
    );
    expect(w.notices(w.owner).map((notice) => [notice.kind, notice.wakes])).toEqual([["done_when", false]]);
  });

  test("an owner proposes done; the developer finishes the line or says not yet", () => {
    const w = world();
    w.as(w.owner, c.lineProposeDone, { ref: w.line, why: "Printed, fitted, and in use." });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneProposal).toBe("Printed, fitted, and in use.");
    w.as(w.dev, c.lineNotYet, { ref: w.line, why: "The plug does not fit yet." });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneProposal).toBeNull();
    const heard = w.notices(w.owner);
    expect(heard.map((notice) => notice.kind)).toEqual(["not_yet"]);
    expect(heard[0]?.body).toContain("The plug does not fit yet.");
  });
});

describe("a line the developer owns", () => {
  test("winds its agents down, takes no owner, refuses agent writes, and goes back with Hand to an agent", () => {
    const w = world();
    w.as(w.dev, c.lineOwn, { ref: w.line });
    expect(w.notices(w.owner).map((notice) => notice.kind)).toEqual(["wind_down"]);
    w.later(16);
    w.tracker.sweep();
    expect(w.as(w.dev, c.homeShow, {}).crews[w.line]).toBeUndefined();
    expect(w.refusal(() => w.as(w.owner, c.lineTake, { ref: w.line })).message).toContain("the developer's");
    w.as(w.dev, c.lineHand, { ref: w.line });
    // Its last owner wound down rather than left, so it is offered the line first.
    expect(w.as(w.dev, c.homeShow, {}).crews[w.line]?.search?.step).toBe(1);
    expect(w.notices(w.owner).map((notice) => notice.kind)).toContain("owner_offer");
  });
});
