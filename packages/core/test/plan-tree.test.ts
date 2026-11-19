import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import { planTree } from "../src/plan.ts";
import { Decision, Issue } from "../src/schemas.ts";
import { harness } from "./helpers.ts";

function refusal(run: () => unknown): OctoError {
  try {
    run();
  } catch (error) {
    if (error instanceof OctoError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

/** A working line with a plan of four steps on the critical path, and an agent that owns it. */
function enclosure() {
  const h = harness();
  h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
  const line = h.developer(c.lineAdd, {
    title: "Sendspin enclosure",
    doneWhen: "A printed case holds the board.",
    repos: ["PANEL"],
    where: "working",
  });
  h.call(c.agentRegister, { repo: "PANEL" });
  h.call(c.lineTake, { ref: line.ref });
  h.call(c.planSet, {
    line: line.ref,
    steps: ["Model the base", "Print and test-fit", "Final print", "Hang it in the hallway"],
  });
  return { h, line: line.ref };
}

const addresses = (h: ReturnType<typeof harness>, line: string) =>
  h.developer(c.lineShow, { ref: line }).steps.map((step) => `${step.address} ${step.title}`);

describe("a plan as a tree", () => {
  test("a branch forks from a step, holds up a later one, and its steps read 2a.1, 2a.2 in tree order", () => {
    const { h, line } = enclosure();
    const branch = h.call(c.planBranch, {
      line,
      from: "2",
      holdsUp: "3",
      title: "Order the USB-C breakout",
      steps: ["Pick a board", "Order it and wait for delivery"],
    });
    expect(branch.map((b) => [b.address, b.title, b.holdsUp])).toEqual([
      ["2a", "Order the USB-C breakout", "3"],
    ]);
    h.call(c.planBranch, { line, from: "4", title: "Photos for the README", steps: ["Take the photos"] });
    expect(addresses(h, line)).toEqual([
      "1 Model the base",
      "2 Print and test-fit",
      "2a.1 Pick a board",
      "2a.2 Order it and wait for delivery",
      "3 Final print",
      "4 Hang it in the hallway",
      "4a.1 Take the photos",
    ]);
    const shown = h.developer(c.lineShow, { ref: line });
    const tree = planTree(shown.steps, shown.branches);
    expect(tree.map((node) => [node.step.address, node.branches.map((b) => b.branch.address)])).toEqual([
      ["1", []],
      ["2", ["2a"]],
      ["3", []],
      ["4", ["4a"]],
    ]);
    expect(tree[2]?.waitsOn).toEqual(["2a"]);
    expect(tree[3]?.waitsOn).toEqual([]);
  });

  test("branches fork from branch steps too, and a branch holds up a later step of the sequence it forks from", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, { line, from: "2", holdsUp: "3", title: "Breakout", steps: ["Pick", "Order"] });
    h.call(c.planBranch, { line, from: "2a.1", holdsUp: "2a.2", title: "Datasheets", steps: ["Read them"] });
    expect(addresses(h, line)).toContain("2a.1a.1 Read them");
    expect(
      refusal(() => h.call(c.planBranch, { line, from: "3", holdsUp: "2", title: "Back", steps: ["x"] }))
        .message,
    ).toContain("later step");
    expect(
      refusal(() => h.call(c.planBranch, { line, from: "2a.1", holdsUp: "3", title: "Far", steps: ["x"] }))
        .message,
    ).toContain("later step");
  });

  test("a step that waits on an open branch says so, and once done it waits on nothing", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, {
      line,
      from: "2",
      holdsUp: "3",
      title: "Order the breakout",
      steps: ["Pick", "Order"],
    });
    const waits = () => {
      const shown = h.developer(c.lineShow, { ref: line });
      return planTree(shown.steps, shown.branches)[2]?.waitsOn;
    };
    expect(waits()).toEqual(["2a"]);
    h.call(c.planStep, { line, step: "3", status: "done" });
    expect(waits()).toEqual([]);
  });

  test("an issue sits on any step by its address, and stays on it when the plan is rewritten around it", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, { line, from: "2", holdsUp: "3", title: "Breakout", steps: ["Pick", "Order"] });
    const onBranch = h.call(c.issueCreate, { project: "PANEL", title: "Solder", line, step: "2a.2" });
    const onPath = h.call(c.issueCreate, { project: "PANEL", title: "Print", line, step: 3 });
    const shown = () => h.developer(c.lineShow, { ref: line });
    const addressOf = (ref: string) => {
      const detail = shown();
      const step = detail.work.find((item) => item.ref === ref)?.step;
      return detail.steps.find((candidate) => candidate.id === step)?.address;
    };
    expect([addressOf(onBranch.ref), addressOf(onPath.ref)]).toEqual(["2a.2", "3"]);

    // A step goes in before step 2: the branch and both issues move with their steps, not their numbers.
    h.call(c.planSet, {
      line,
      steps: [
        "Model the base",
        "Test the board",
        "Print and test-fit",
        "Final print",
        "Hang it in the hallway",
      ],
    });
    expect([addressOf(onBranch.ref), addressOf(onPath.ref)]).toEqual(["3a.2", "4"]);
    expect(shown().branches.map((b) => [b.address, b.holdsUp])).toEqual([["3a", "4"]]);

    // Steps that leave the plan take nothing with them: their issues are on no step, their branches move up a step.
    h.call(c.planSet, { line, steps: ["Model the base", "Final print"] });
    expect(addressOf(onPath.ref)).toBe("2");
    expect(shown().branches.map((b) => [b.address, b.holdsUp])).toEqual([["1a", "2"]]);
    expect(
      refusal(() => h.call(c.issueCreate, { project: "PANEL", title: "x", line, step: "9z.1" })).code,
    ).toBe("invalid_input");
  });

  test("removing a branch puts its issues back on the step it forked from", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, { line, from: "2", title: "Breakout", steps: ["Pick"] });
    const issue = h.call(c.issueCreate, { project: "PANEL", title: "Solder", line, step: "2a.1" });
    h.call(c.planBranchUpdate, { line, branch: "2a", title: "USB-C breakout", steps: ["Pick", "Order"] });
    expect(addresses(h, line)).toContain("2a.2 Order");
    h.call(c.planBranchRemove, { line, branch: "2a" });
    const detail = h.developer(c.lineShow, { ref: line });
    expect(detail.branches).toEqual([]);
    const step = detail.work.find((item) => item.ref === issue.ref)?.step;
    expect(detail.steps.find((candidate) => candidate.id === step)?.address).toBe("2");
  });

  test("the developer makes a branch its own line: its steps and issues move, and the old step waits on that line", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, {
      line,
      from: "3",
      holdsUp: "4",
      title: "Wall bracket",
      steps: ["Draw it", "Print it", "Screw it up"],
    });
    const issue = h.call(c.issueCreate, { project: "PANEL", title: "Measure the wall", line, step: "3a.1" });
    const bracket = h.developer(c.planPromote, {
      line,
      branch: "3a",
      doneWhen: "A bracket on the hallway wall holds the case level.",
      where: "up_next",
    });
    expect([bracket.title, bracket.state, bracket.repos]).toEqual(["Wall bracket", "up_next", ["PANEL"]]);

    const child = h.developer(c.lineShow, { ref: bracket.ref });
    expect(child.steps.map((s) => `${s.address} ${s.title}`)).toEqual([
      "1 Draw it",
      "2 Print it",
      "3 Screw it up",
    ]);
    expect(child.work.map((item) => item.ref)).toEqual([issue.ref]);
    expect(child.branchOf).toEqual({
      line,
      title: "Sendspin enclosure",
      address: "3a",
      holdsUp: { address: "4", title: "Hang it in the hallway" },
    });

    const parent = h.developer(c.lineShow, { ref: line });
    expect(parent.branches.map((b) => [b.address, b.became?.ref, b.state])).toEqual([
      ["3a", bracket.ref, "open"],
    ]);
    expect(parent.steps.map((s) => s.address)).toEqual(["1", "2", "3", "4"]);
    expect(planTree(parent.steps, parent.branches)[3]?.waitsOn).toEqual([bracket.ref]);

    h.developer(c.lineStart, { ref: bracket.ref });
    h.developer(c.lineDone, { ref: bracket.ref });
    expect(h.developer(c.lineShow, { ref: line }).branches[0]?.state).toBe("done");
    h.call(c.planStep, { line, step: "4", status: "done" });
  });

  test("a line made from a branch that is dropped stops holding its step up", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, { line, from: "3", holdsUp: "4", title: "Bracket", steps: ["Draw it"] });
    const bracket = h.developer(c.planPromote, {
      line,
      branch: "3a",
      doneWhen: "It holds.",
      where: "up_next",
    });
    h.developer(c.lineDrop, { ref: bracket.ref });
    expect(h.developer(c.lineShow, { ref: line }).branches[0]?.state).toBe("ended");
    h.call(c.planStep, { line, step: "4", status: "done" });
  });

  test("an owner's promotion is a proposal with a recommendation", () => {
    const { h, line } = enclosure();
    h.call(c.planBranch, { line, from: "3", holdsUp: "4", title: "Bracket", steps: ["Draw it"] });
    const proposed = h.call(c.planPromote, { line, branch: "3a", doneWhen: "It holds." });
    expect([proposed.state, proposed.proposedBy, proposed.recommendation]).toEqual([
      "proposed",
      "agent-a",
      "up_next",
    ]);
    expect(proposed.recommendationWhy).toContain(line);
    expect(refusal(() => h.call(c.planPromote, { line, branch: "3a", doneWhen: "Again." })).code).toBe(
      "conflict",
    );
  });

  test("home says how many branches are open and what the current step waits on", () => {
    const { h, line } = enclosure();
    h.call(c.planStep, { line, step: "1", status: "done" });
    h.call(c.planStep, { line, step: "2", status: "done" });
    h.call(c.planBranch, { line, from: "2", holdsUp: "3", title: "Breakout", steps: ["Pick"] });
    h.call(c.planBranch, { line, from: "4", title: "Photos", steps: ["Take them"] });
    const details = h.developer(c.homeShow, {}).lines[line];
    expect(details?.step).toEqual({
      position: 3,
      of: 4,
      title: "Final print",
      waitsOn: ["2a"],
      stalledOn: [],
    });
    expect(details?.branchesOpen).toBe(2);
    // A line made from a branch the step waits on, tabled, stalls it: home says which.
    h.call(c.planBranch, { line, from: "2", holdsUp: "3", title: "Bracket", steps: ["Draw it"] });
    const bracket = h.developer(c.planPromote, {
      line,
      branch: "2b",
      doneWhen: "It holds.",
      where: "up_next",
    });
    h.developer(c.lineTable, { ref: bracket.ref, reason: "After the move" });
    expect(h.developer(c.homeShow, {}).lines[line]?.step?.stalledOn).toEqual([bracket.ref]);
  });

  describe("audit of D15", () => {
    test("1: taking out the first step keeps its branches, moved to the new first step, with their issues", () => {
      const { h, line } = enclosure();
      h.call(c.planBranch, { line, from: "1", holdsUp: "3", title: "Side", steps: ["Look", "Order"] });
      const issue = h.call(c.issueCreate, { project: "PANEL", title: "Read", line, step: "1a.1" });
      h.call(c.planSet, { line, steps: ["Print and test-fit", "Final print", "Hang it in the hallway"] });
      const detail = h.developer(c.lineShow, { ref: line });
      expect(detail.branches.map((b) => [b.address, b.holdsUp])).toEqual([["1a", "2"]]);
      expect(detail.steps.map((step) => step.address)).toEqual(["1", "1a.1", "1a.2", "2", "3"]);
      const step = detail.work.find((item) => item.ref === issue.ref)?.step;
      expect(detail.steps.find((candidate) => candidate.id === step)?.address).toBe("1a.1");
    });

    test("1: taking out a branch's first step keeps a branch forking from it, and a line made from that keeps its link", () => {
      const { h, line } = enclosure();
      h.call(c.planBranch, { line, from: "2", title: "Breakout", steps: ["Pick", "Order"] });
      h.call(c.planBranch, { line, from: "2a.1", title: "Datasheets", steps: ["Read them"] });
      h.call(c.planBranch, { line, from: "2a.1", title: "Supplier", steps: ["Ask"] });
      const supplier = h.developer(c.planPromote, {
        line,
        branch: "2a.1b",
        doneWhen: "Chosen.",
        where: "up_next",
      });
      h.call(c.planBranchUpdate, { line, branch: "2a", steps: ["Order", "Test"] });
      const detail = h.developer(c.lineShow, { ref: line });
      expect(detail.branches.map((b) => [b.address, b.title])).toEqual([
        ["2a", "Breakout"],
        ["2a.1a", "Datasheets"],
        ["2a.1b", "Supplier"],
      ]);
      expect(detail.steps.map((step) => step.address)).toContain("2a.1a.1");
      expect(h.developer(c.lineShow, { ref: supplier.ref }).branchOf?.address).toBe("2a.1b");
    });

    test("2: making a branch a line frees its claimed work, says so in the feed, and takes its questions along", () => {
      const { h, line } = enclosure();
      h.call(c.planBranch, { line, from: "2", title: "Breakout", steps: ["Pick"] });
      const issue = h.call(c.issueCreate, { project: "PANEL", title: "Solder", line, step: "2a.1" });
      h.call(c.issueClaim, { refs: [issue.ref] });
      h.call(c.issueUpdate, { refs: [issue.ref], status: "in_progress" });
      const asked = h.call(c.decisionAsk, {
        title: "Which header?",
        context: "Two fit.",
        options: [
          { key: "a", label: "Straight", description: "Fits flat." },
          { key: "b", label: "Angled", description: "Fits the lid." },
        ],
        issue: issue.ref,
      });
      const breakout = h.developer(c.planPromote, {
        line,
        branch: "2a",
        doneWhen: "Soldered.",
        where: "up_next",
      });
      const moved = Issue.parse(h.developer(c.entityShow, { ref: issue.ref }).entity);
      expect([moved.line, moved.assignee, moved.status]).toEqual([breakout.ref, null, "todo"]);
      const feed = h.developer(c.feedList, { query: issue.ref });
      expect(
        feed.events.some((event) => event.type === "issue.updated" && event.summary.includes(breakout.ref)),
      ).toBe(true);
      expect(Decision.parse(h.developer(c.entityShow, { ref: asked.ref }).entity).line).toBe(breakout.ref);
    });

    test("3: a branch named by its id is the same branch even after an earlier one is removed", () => {
      const { h, line } = enclosure();
      h.call(c.planBranch, { line, from: "2", title: "First", steps: ["a"] });
      h.call(c.planBranch, { line, from: "2", title: "Second", steps: ["b"] });
      const branches = h.call(c.planBranch, { line, from: "2", title: "Third", steps: ["c"] });
      const second = branches.find((branch) => branch.title === "Second");
      if (second === undefined) throw new Error("Second was added");
      h.call(c.planBranchRemove, { line, branch: "2a" });
      // Second is 2a now and Third 2b; a removal queued for 2b by id still means Second.
      h.developer(c.planBranchRemove, { line, branch: second.address, id: second.id });
      expect(h.developer(c.lineShow, { ref: line }).branches.map((b) => b.title)).toEqual(["Third"]);
      const third = h.developer(c.lineShow, { ref: line }).steps.find((step) => step.title === "c");
      if (third === undefined) throw new Error("Third has its step");
      h.developer(c.planStep, { line, step: "9", stepId: third.id, status: "done" });
      expect(h.developer(c.lineShow, { ref: line }).steps.find((step) => step.id === third.id)?.status).toBe(
        "done",
      );
    });

    test("6: an owner with nothing to pick up is pointed at the branch its current step waits on", () => {
      const { h, line } = enclosure();
      h.call(c.planStep, { line, step: "1", status: "done" });
      h.call(c.planStep, { line, step: "2", status: "done" });
      h.call(c.planBranch, { line, from: "2", holdsUp: "3", title: "Breakout", steps: ["Pick a board"] });
      const taken = h.call(c.lineTake, { ref: line });
      expect(taken.message).toContain("break step 2a.1 into issues");
      expect(taken.message).not.toContain("step 3 done");
    });

    test("removing a branch that a line was made from leaves that line, unlinked", () => {
      const { h, line } = enclosure();
      h.call(c.planBranch, { line, from: "3", holdsUp: "4", title: "Bracket", steps: ["Draw it"] });
      const bracket = h.developer(c.planPromote, {
        line,
        branch: "3a",
        doneWhen: "It holds.",
        where: "up_next",
      });
      h.developer(c.planBranchRemove, { line, branch: "3a" });
      expect(h.developer(c.lineShow, { ref: bracket.ref }).line.state).toBe("up_next");
      expect(h.developer(c.lineShow, { ref: bracket.ref }).branchOf).toBeNull();
      h.call(c.planStep, { line, step: "4", status: "done" });
    });

    test("promotion carries a branch's own branches, with their steps and issues, re-addressed on the new line", () => {
      const { h, line } = enclosure();
      h.call(c.planBranch, { line, from: "2", title: "Breakout", steps: ["Pick", "Order"] });
      h.call(c.planBranch, {
        line,
        from: "2a.1",
        holdsUp: "2a.2",
        title: "Datasheets",
        steps: ["Read them"],
      });
      const issue = h.call(c.issueCreate, { project: "PANEL", title: "Read", line, step: "2a.1a.1" });
      const breakout = h.developer(c.planPromote, {
        line,
        branch: "2a",
        doneWhen: "Done.",
        where: "up_next",
      });
      const child = h.developer(c.lineShow, { ref: breakout.ref });
      expect(child.steps.map((step) => `${step.address} ${step.title}`)).toEqual([
        "1 Pick",
        "1a.1 Read them",
        "2 Order",
      ]);
      expect(child.branches.map((b) => [b.address, b.holdsUp])).toEqual([["1a", "2"]]);
      const step = child.work.find((item) => item.ref === issue.ref)?.step;
      expect(child.steps.find((candidate) => candidate.id === step)?.address).toBe("1a.1");
      expect(h.developer(c.lineShow, { ref: line }).steps.map((s) => s.address)).toEqual([
        "1",
        "2",
        "3",
        "4",
      ]);
    });
  });
});
