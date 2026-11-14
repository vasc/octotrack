import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import { Tracker } from "../src/tracker.ts";
import { buildVersion4 } from "./fixtures/version4.ts";
import { harness, memoryDriver } from "./helpers.ts";

function withRepos() {
  const h = harness();
  h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack" });
  return h;
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

describe("lines of work", () => {
  test("the developer adds lines where they belong, each with a ref and a goal", () => {
    const h = withRepos();
    const enclosure = h.developer(c.lineAdd, {
      title: "Sendspin enclosure",
      doneWhen: "A printed case holds the board and takes the USB-C plug.",
      repos: ["PANEL"],
      where: "working",
    });
    const mount = h.developer(c.lineAdd, {
      title: "Wall mount",
      doneWhen: "It hangs flush.",
      repos: ["PANEL"],
      where: "up_next",
    });
    expect(enclosure.ref).toBe("L-1");
    expect(enclosure.state).toBe("working");
    expect(enclosure.repos).toEqual(["PANEL"]);
    expect(mount.state).toBe("up_next");
  });

  test("tabling needs a reason, and keeps an optional date to look again", () => {
    const h = withRepos();
    const line = h.developer(c.lineAdd, {
      title: "Podcast cleanup",
      doneWhen: "No duplicates.",
      repos: [],
      where: "working",
    });
    expect(refusal(() => h.developer(c.lineTable, { ref: line.ref, reason: " " })).code).toBe(
      "invalid_input",
    );
    const tabled = h.developer(c.lineTable, {
      ref: line.ref,
      reason: "The disk is not tight",
      lookAgainAt: "2027-02-01",
    });
    expect(tabled.state).toBe("tabled");
    expect(tabled.tabledReason).toBe("The disk is not tight");
    expect(tabled.lookAgainAt).toBe("2027-02-01");
  });

  test("an agent proposes; only the developer places, unless the agent quotes what the developer said", () => {
    const h = withRepos();
    const proposal = h.call(
      c.linePropose,
      {
        title: "Widgets redesign",
        doneWhen: "The new card forms are on every panel screen.",
        repos: ["PANEL"],
        recommendation: "up_next",
        why: "The enclosure's final print moves the mounting points.",
      },
      "panel-widgets",
    );
    expect(proposal.state).toBe("proposed");
    expect(proposal.proposedBy).toBe("panel-widgets");

    const refused = refusal(() => h.call(c.lineStart, { ref: proposal.ref }, "panel-widgets"));
    expect(refused.code).toBe("forbidden");
    expect(refused.hint).toContain("--said");

    const started = h.tracker.call(
      c.lineStart,
      { ref: proposal.ref },
      { actor: "panel-widgets", channel: "cli", said: "yes, start the widgets one" },
    );
    expect(started.state).toBe("working");
    const event = h.call(c.feedList, { query: `ref:${proposal.ref} event:line.started` }).events[0];
    expect(event?.actor).toBe("panel-widgets");
    expect(event?.attrs.said).toBe("yes, start the widgets one");
    expect(event?.attrs.channel).toBe("out_of_band");
  });

  test("the order is the developer's: lines move within their section", () => {
    const h = withRepos();
    const add = (title: string) =>
      h.developer(c.lineAdd, { title, doneWhen: "Done.", repos: [], where: "working" }).ref;
    const [a, b, d] = [add("One"), add("Two"), add("Three")];
    h.developer(c.lineOrder, { ref: d, to: "top" });
    expect(h.developer(c.homeShow, {}).working.map((line) => line.ref)).toEqual([d, a, b]);
    h.developer(c.lineOrder, { ref: a, after: b });
    expect(h.developer(c.homeShow, {}).working.map((line) => line.ref)).toEqual([d, b, a]);
  });

  test("home shows every section in order, with proposals and tabled lines apart", () => {
    const h = withRepos();
    h.developer(c.lineAdd, { title: "Working one", doneWhen: "Done.", repos: [], where: "working" });
    h.developer(c.lineAdd, { title: "Next one", doneWhen: "Done.", repos: [], where: "up_next" });
    const tabled = h.developer(c.lineAdd, {
      title: "Later one",
      doneWhen: "Done.",
      repos: [],
      where: "working",
    });
    h.developer(c.lineTable, { ref: tabled.ref, reason: "Not now" });
    h.call(c.linePropose, {
      title: "An idea",
      doneWhen: "Done.",
      repos: [],
      recommendation: "table",
      why: "No hurry.",
    });
    const home = h.developer(c.homeShow, {});
    expect(home.working.map((line) => line.title)).toEqual(["Working one"]);
    expect(home.upNext.map((line) => line.title)).toEqual(["Next one"]);
    expect(home.tabled.map((line) => line.title)).toEqual(["Later one"]);
    expect(home.proposed.map((line) => line.title)).toEqual(["An idea"]);
  });

  test("issues belong to a line and a step of its plan", () => {
    const h = withRepos();
    const line = h.developer(c.lineAdd, {
      title: "Sendspin enclosure",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    h.call(c.planSet, { line: line.ref, steps: ["Model the base", "Print and test-fit", "Final print"] });
    const issue = h.call(c.issueCreate, {
      project: "PANEL",
      title: "Measure the grip",
      line: line.ref,
      step: 2,
    });
    expect(issue.line).toBe(line.ref);
    expect(issue.step).toBe(2);
    const shown = h.developer(c.lineShow, { ref: line.ref });
    expect(shown.steps.map((step) => step.title)).toEqual([
      "Model the base",
      "Print and test-fit",
      "Final print",
    ]);
    expect(shown.issues.map((summary) => summary.ref)).toEqual([issue.ref]);
    expect(
      h.call(c.entityFind, { query: `line:${line.ref} kind:issue` }).map((summary) => summary.ref),
    ).toEqual([issue.ref]);
  });

  test("folding moves a line's issues into another and ends it; not a line drops a proposal", () => {
    const h = withRepos();
    const keep = h.developer(c.lineAdd, {
      title: "Keep",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    const fold = h.call(c.linePropose, {
      title: "Fold me",
      doneWhen: "Done.",
      repos: ["PANEL"],
      recommendation: "fold",
      why: "Same work.",
    });
    const issue = h.call(c.issueCreate, { project: "PANEL", title: "Some work", line: fold.ref });
    const folded = h.developer(c.lineFold, { ref: fold.ref, into: keep.ref });
    expect(folded.state).toBe("dropped");
    expect(h.call(c.entityShow, { ref: issue.ref }).entity.ref).toBe(issue.ref);
    expect(h.developer(c.lineShow, { ref: keep.ref }).issues.map((summary) => summary.ref)).toEqual([
      issue.ref,
    ]);

    const idea = h.call(c.linePropose, {
      title: "Not really",
      doneWhen: "Done.",
      repos: [],
      recommendation: "table",
      why: "Maybe.",
    });
    expect(h.developer(c.lineReject, { ref: idea.ref }).state).toBe("dropped");
  });

  test("any ref spelling resolves, and a line shows like any other item", () => {
    const h = withRepos();
    const line = h.developer(c.lineAdd, {
      title: "Sendspin enclosure",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "working",
    });
    const shown = h.call(c.entityShow, { ref: "l-1" });
    expect(shown.entity.ref).toBe(line.ref);
    expect(shown.summary.kind).toBe("line");
    expect(shown.summary.status).toBe("working");
  });
});

describe("moving an older database to lines", () => {
  test("open ideas become proposals from before, and every old ref still resolves, an idea's to the line it became", () => {
    const driver = memoryDriver();
    buildVersion4(driver);
    const tracker = new Tracker(driver, () => "2026-11-14T12:00:00.000Z");
    const home = tracker.call(c.homeShow, {}, { actor: "dev", channel: "dashboard", developer: true });
    expect(home.proposed.map((line) => [line.title, line.fromRef, line.repos])).toEqual([
      ["Wall mount", "I-1", ["PANEL"]],
      ["A weekly digest", "I-2", []],
    ]);
    const show = (ref: string) =>
      tracker.call(c.entityShow, { ref }, { actor: "dev", channel: "cli", developer: true }).entity.ref;
    for (const ref of ["PANEL", "PANEL-6", "D-34", "M-1", "I-3", "U-1", "U-2", "PR-1"])
      expect(show(ref)).toBe(ref);
    expect([show("I-1")]).toEqual(home.proposed.slice(0, 1).map((line) => line.ref));
  });
});

describe("first run", () => {
  test("Accept takes each proposal's recommended placement in one go; a fold or a proposal with no advice is left", () => {
    const h = withRepos();
    const propose = (title: string, recommendation: "start" | "up_next" | "table" | "fold") =>
      h.call(c.linePropose, {
        title,
        doneWhen: "Done.",
        repos: ["PANEL"],
        recommendation,
        why: `Because ${title}.`,
      }).ref;
    const start = propose("Start me", "start");
    const queue = propose("Queue me", "up_next");
    const table = propose("Table me", "table");
    const fold = propose("Fold me", "fold");
    const placed = h.developer(c.lineAcceptRecommended, { refs: [start, queue, table, fold] });
    expect(placed.map((line) => [line.ref, line.state])).toEqual([
      [start, "working"],
      [queue, "up_next"],
      [table, "tabled"],
    ]);
    expect(h.developer(c.lineShow, { ref: table }).line.tabledReason).toBe("Because Table me.");
    expect(h.developer(c.lineShow, { ref: fold }).line.state).toBe("proposed");
  });
});
