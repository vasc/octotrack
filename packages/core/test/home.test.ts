import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const OPTIONS = [
  { key: "a", label: "26 mm", description: "Print as it is." },
  { key: "b", label: "30 mm", description: "Remodel first." },
];

function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const tracker = new Tracker(memoryDriver(), () => now, { remoteOf: () => "vasc/homepanel" });
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const agent = (name: string): Caller => ({ actor: name, channel: "cli", checkout: `/src/${name}` });
  function as<I extends z.ZodType, O extends z.ZodType>(
    caller: Caller,
    contract: Contract<I, O>,
    input: z.input<I>,
  ) {
    return tracker.call(contract, input, caller);
  }
  as(dev, c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
  as(dev, c.placeAdd, { name: "the bench" });
  return {
    tracker,
    dev,
    agent,
    as,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * 60_000).toISOString();
    },
  };
}

describe("home: one list, with what each line needs from the developer", () => {
  test("a working line says its plan step and what waits on the developer, questions before tasks", () => {
    const w = world();
    const line = w.as(w.dev, c.lineAdd, {
      title: "Enclosure",
      doneWhen: "It fits.",
      repos: ["PANEL"],
      where: "working",
    });
    w.as(w.dev, c.planSet, { line: line.ref, steps: ["Model", "Print", "Fit"] });
    const panel = w.agent("panel");
    w.as(panel, c.lineTake, { ref: line.ref });
    const task = w.as(panel, c.taskFile, { title: "Measure", place: "the bench", outcome: "Numbers." });
    const asked = w.as(panel, c.decisionAsk, {
      title: "Which board?",
      context: "Printed base.",
      options: OPTIONS,
    });

    const home = w.as(w.dev, c.homeShow, {});
    const details = home.lines[line.ref];
    expect(details?.step).toEqual({ position: 1, of: 3, title: "Model" });
    expect(
      details?.forYou.map((item) =>
        item.kind === "question" ? item.card.decision.ref : item.kind === "task" ? item.task.ref : item.line,
      ),
    ).toEqual([asked.ref, task.ref]);
    expect(home.counts).toEqual({ toAnswer: 1, toDo: 1, toAccept: 0, toStepIn: 0, urgent: 0 });
  });

  test("up-next lines say what they hold and how far scoping got; proposals and step-ins are counted", () => {
    const w = world();
    const waiting = w.as(w.dev, c.lineAdd, {
      title: "Wall mount",
      doneWhen: "It hangs.",
      repos: ["PANEL"],
      where: "up_next",
    });
    const scoper = w.agent("garden");
    w.as(scoper, c.lineTake, { ref: waiting.ref });
    w.as(scoper, c.planSet, { line: waiting.ref, steps: ["Measure", "Print"] });
    w.as(scoper, c.taskFile, { title: "Measure the wall", place: "the bench", outcome: "Width." });
    w.as(scoper, c.lineRelease, {});
    w.as(w.agent("panel"), c.linePropose, {
      title: "Widgets",
      doneWhen: "New cards everywhere.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "After the mount.",
    });
    const nobody = w.as(w.dev, c.lineAdd, {
      title: "Trip",
      doneWhen: "Booked.",
      repos: ["PANEL"],
      where: "working",
    });
    w.later(1);

    const home = w.as(w.dev, c.homeShow, {});
    expect(home.lines[waiting.ref]?.held).toEqual({ questions: 0, tasks: 1 });
    expect(home.lines[waiting.ref]?.scopedSteps).toBe(2);
    expect(home.lines[nobody.ref]?.forYou).toEqual([]);
    expect(home.counts).toMatchObject({ toAccept: 1, toStepIn: 1 });
  });

  test("an urgent question stands at the very top, apart from its line", () => {
    const w = world();
    const line = w.as(w.dev, c.lineAdd, {
      title: "Enclosure",
      doneWhen: "It fits.",
      repos: ["PANEL"],
      where: "working",
    });
    const panel = w.agent("panel");
    w.as(panel, c.lineTake, { ref: line.ref });
    const urgent = w.as(panel, c.decisionAsk, {
      title: "Order today?",
      context: "The sale ends tonight.",
      options: OPTIONS,
      urgent: "costs_money",
    });
    const home = w.as(w.dev, c.homeShow, {});
    expect(home.urgent.map((card) => card.decision.ref)).toEqual([urgent.ref]);
    expect(home.lines[line.ref]?.forYou).toEqual([]);
    expect(home.counts.urgent).toBe(1);
  });
});
