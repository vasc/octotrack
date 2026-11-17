import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { harness } from "./helpers.ts";

/**
 * Octotrack tracks agents' work; it does not hold permissions over it. In the developer's words: "I don't want idiotic
 * permissions", "This is about tracking agent work", "No one asked for permissions", and then "Do everything".
 */
describe("an agent may do what was once only the developer's", () => {
  test("place, order, move, fold, reject, own, hand over and finish lines", () => {
    const h = harness();
    h.call(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
    h.call(c.projectUpdate, { ref: "PANEL", repo: "vasc/panel" });
    const one = h.call(c.lineAdd, { title: "One", doneWhen: "Done.", repos: ["PANEL"], where: "working" });
    const two = h.call(c.lineAdd, { title: "Two", doneWhen: "Done.", repos: ["PANEL"], where: "working" });
    h.call(c.lineOrder, { ref: two.ref, to: "top" });
    h.call(c.lineQueue, { ref: one.ref });
    h.call(c.lineStart, { ref: one.ref });
    h.call(c.lineTable, { ref: one.ref, reason: "Later" });
    const placed = h.call(c.linePropose, {
      title: "Three",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "It waits.",
      place: "queue",
    });
    expect(placed.state).toBe("up_next");
    const idea = h.call(c.linePropose, {
      title: "Four",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "Maybe.",
    });
    h.call(c.lineAcceptRecommended, { refs: [idea.ref] });
    const nope = h.call(c.linePropose, {
      title: "Five",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "table",
      why: "No.",
    });
    h.call(c.lineReject, { ref: nope.ref });
    h.call(c.lineFold, { ref: placed.ref, into: two.ref });
    h.call(c.lineOwn, { ref: two.ref });
    h.call(c.taskAdd, { line: two.ref, title: "Measure it" });
    h.call(c.noteAdd, { line: two.ref, body: "A note." });
    h.call(c.lineHand, { ref: two.ref });
    h.call(c.lineTell, { line: two.ref, body: "Go on." });
    h.call(c.lineDone, { ref: two.ref });
    expect(h.developer(c.lineShow, { ref: two.ref }).line.state).toBe("done");
  });

  test("answer a done when, say not yet, finish tasks, keep places, and stop, lift and release agents", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
    const line = h.developer(c.lineAdd, {
      title: "One",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    h.call(c.agentRegister, { repo: "PANEL" }, "owner");
    h.call(c.lineTake, { ref: line.ref }, "owner");
    h.call(c.lineDoneWhen, { ref: line.ref, doneWhen: "It ships." }, "owner");
    h.call(c.lineDoneWhenAnswer, { ref: line.ref, accept: true });
    h.call(c.lineProposeDone, { ref: line.ref, why: "It shipped." }, "owner");
    h.call(c.lineNotYet, { ref: line.ref, why: "Not quite." });
    h.call(c.placeAdd, { name: "the bench" });
    const task = h.call(
      c.taskFile,
      { line: line.ref, title: "Measure", place: "the bench", outcome: "Numbers." },
      "owner",
    );
    h.call(c.taskDone, { ref: task.ref, result: "12 mm" });
    const other = h.call(
      c.taskFile,
      { line: line.ref, title: "Weigh", place: "the bench", outcome: "Grams." },
      "owner",
    );
    h.call(c.taskCant, { ref: other.ref, why: "No scale" });
    h.call(c.placeRemove, { name: "the bench" });
    h.call(c.agentStop, { name: "owner" });
    h.call(c.agentLift, { name: "owner" });
    h.call(c.agentRelease, { name: "owner" });
    expect(h.developer(c.lineShow, { ref: line.ref }).line.doneWhen).toBe("It ships.");
  });

  test("an agent's promotion of a branch is placed where it says, when it says", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
    const line = h.developer(c.lineAdd, {
      title: "One",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    h.call(c.agentRegister, { repo: "PANEL" });
    h.call(c.lineTake, { ref: line.ref });
    h.call(c.planSet, { line: line.ref, steps: ["A", "B"] });
    h.call(c.planBranch, { line: line.ref, from: "1", title: "Side", steps: ["x"] });
    expect(
      h.call(c.planPromote, { line: line.ref, branch: "1a", doneWhen: "Done.", where: "working" }).state,
    ).toBe("working");
  });
});
