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

describe("an agent writes to any line, whatever line it is on and whatever state the line is in", () => {
  test("files, changes and claims work, plans, asks and withdraws, with no claim on that line", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
    h.developer(c.projectCreate, { key: "OCT", name: "Octotrack", repo: "vasc/octotrack" });
    const working = h.developer(c.lineAdd, {
      title: "Working",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    const next = h.developer(c.lineAdd, {
      title: "Next",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "up_next",
    });
    const mine = h.developer(c.lineAdd, { title: "Mine", doneWhen: "Done.", where: "working" });
    const proposal = h.call(
      c.linePropose,
      { title: "Theirs", doneWhen: "Done.", repos: ["OCT"], recommendation: "up_next", why: "Soon." },
      "someone-else",
    );
    // An agent registered in OCT, on no line, writes to all of them.
    h.call(c.agentRegister, { repo: "OCT" }, "roamer");
    const onWorking = h.call(c.issueCreate, { project: "PANEL", title: "Base", line: working.ref }, "roamer");
    h.call(c.issueClaim, { refs: [onWorking.ref] }, "roamer");
    h.call(c.issueUpdate, { refs: [onWorking.ref], status: "in_progress" }, "roamer");
    const onNext = h.call(c.issueCreate, { project: "PANEL", title: "Lid", line: next.ref }, "roamer");
    h.call(c.issueUpdate, { refs: [onNext.ref], status: "in_progress" }, "roamer");
    h.call(c.planSet, { line: proposal.ref, steps: ["Sketch"] }, "roamer");
    h.call(c.planSet, { line: mine.ref, steps: ["Scan"] }, "roamer");
    const asked = h.call(
      c.decisionAsk,
      {
        title: "Which lid?",
        context: "Two fit.",
        line: next.ref,
        options: [
          { key: "a", label: "Flat", description: "Prints fast." },
          { key: "b", label: "Domed", description: "Looks better." },
        ],
      },
      "someone-else",
    );
    h.call(c.decisionWithdraw, { ref: asked.ref }, "roamer");
    expect(h.developer(c.lineShow, { ref: next.ref }).work.map((item) => item.status)).toEqual([
      "in_progress",
    ]);
    // Nothing was refused, so nothing counts toward stopping anyone.
    expect(
      h.developer(c.agentList, {}).find((agent) => agent.name === "roamer")?.stoppedAt ?? null,
    ).toBeNull();
  });
});
