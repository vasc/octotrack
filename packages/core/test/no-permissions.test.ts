import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { harness } from "./helpers.ts";

/**
 * Octotrack tracks agents' work; it does not hold permissions over it: every operation on the work is open to agents
 * as to the developer (docs/DESIGN.md, "No permissions over the work").
 */
describe("an agent may do what was once only the developer's", () => {
  test("place, order, move, fold, reject, own, hand over and finish lines", () => {
    const h = harness();
    h.call(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
    h.call(c.projectUpdate, { ref: "PANEL", repo: "acme/panel" });
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
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
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
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
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
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
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

describe("no rule without a reason", () => {
  test("a line that ended starts again, comes back up next or is tabled; ended lines fold and keep plans", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
    const add = (title: string) =>
      h.developer(c.lineAdd, { title, doneWhen: "Done.", repos: ["PANEL"], where: "working" });
    const done = add("Finished");
    h.developer(c.lineDone, { ref: done.ref });
    expect(h.developer(c.lineStart, { ref: done.ref }).state).toBe("working");
    const dropped = add("Dropped");
    h.developer(c.lineDrop, { ref: dropped.ref });
    expect(h.developer(c.lineQueue, { ref: dropped.ref }).state).toBe("up_next");
    h.developer(c.lineDone, { ref: dropped.ref });
    // Tabled with no reason given, which the line then says.
    expect(h.developer(c.lineTable, { ref: dropped.ref }).tabledReason).toBeNull();
    const ended = add("Ended");
    h.developer(c.lineDone, { ref: ended.ref });
    h.call(c.planSet, { line: ended.ref, steps: ["Write it up"] });
    h.developer(c.lineFold, { ref: ended.ref, into: done.ref });
    const into = add("Into");
    h.developer(c.lineDrop, { ref: into.ref });
    h.developer(c.lineFold, { ref: done.ref, into: into.ref });
    // Owned whatever its state.
    const waiting = h.developer(c.lineAdd, {
      title: "Waits",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "up_next",
    });
    expect(h.developer(c.lineOwn, { ref: waiting.ref }).ownedBy).toBe("dev");
  });

  test("an agent takes any line: tabled, winding down, the developer's own, another repo's, already scoped", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
    h.developer(c.projectCreate, { key: "OCT", name: "Octotrack", repo: "vasc/octotrack" });
    const tabled = h.developer(c.lineAdd, {
      title: "Later",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "tabled",
    });
    h.call(c.agentRegister, { repo: "OCT" }, "far");
    expect(h.call(c.lineTake, { ref: tabled.ref }, "far").role).toBe("scoper");
    h.call(c.lineRelease, {}, "far");
    const mine = h.developer(c.lineAdd, { title: "Mine", doneWhen: "Done.", where: "working" });
    expect(h.call(c.lineTake, { ref: mine.ref }, "far").role).toBe("owner");
    h.call(c.lineRelease, {}, "far");
    // An agent with no repo said takes a line too.
    expect(h.call(c.lineTake, { ref: tabled.ref }, "fresh").role).toBe("scoper");
  });

  test("questions are answered, refined and withdrawn whatever they stand at", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
    const options = [
      { key: "a", label: "Flat", description: "Prints fast." },
      { key: "b", label: "Domed", description: "Looks better." },
    ];
    const asked = h.call(c.decisionAsk, { title: "Which lid?", context: "Two fit.", options });
    h.call(c.decisionWithdraw, { ref: asked.ref });
    expect(h.call(c.decisionResolve, { ref: asked.ref, option: "a" }).status).toBe("decided");
    h.call(c.decisionUpdate, { ref: asked.ref, title: "Which lid, for the hallway?" });
    expect(h.call(c.decisionWithdraw, { ref: asked.ref }).status).toBe("withdrawn");
  });

  test("tasks and notes go on any line, and a task at a new place adds the place", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
    const line = h.developer(c.lineAdd, {
      title: "Agents'",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    h.developer(c.taskAdd, { line: line.ref, title: "Measure it" });
    h.developer(c.noteAdd, { line: line.ref, body: "The tape is in the drawer." });
    h.call(c.agentRegister, { repo: "PANEL" });
    h.call(c.lineTake, { ref: line.ref });
    h.call(c.taskFile, { title: "Weigh it", place: "the shed", outcome: "Grams." });
    expect(h.developer(c.placeList, {}).map((place) => place.name)).toContain("the shed");
  });

  test("a plan step is done even while a branch it waits on is open, and a branch may hold up a done step", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "acme/homepanel" });
    const line = h.developer(c.lineAdd, {
      title: "One",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    h.developer(c.planSet, { line: line.ref, steps: ["A", "B", "C"] });
    h.developer(c.planBranch, { line: line.ref, from: "1", holdsUp: "2", title: "Side", steps: ["x"] });
    h.developer(c.planStep, { line: line.ref, step: "2", status: "done" });
    h.developer(c.planStep, { line: line.ref, step: "3", status: "done" });
    h.developer(c.planBranch, { line: line.ref, from: "1", holdsUp: "3", title: "Late", steps: ["y"] });
    // A done step waits on nothing, so home says nothing waits.
    expect(h.developer(c.lineShow, { ref: line.ref }).steps.map((step) => step.status)).toContain("done");
  });
});
