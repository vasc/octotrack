import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import { harness } from "./helpers.ts";

/** A working line with two issues, each with an open pull request, and a third pull request still a draft. */
function lineWithPrs() {
  const h = harness();
  h.developer(c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
  const line = h.developer(c.lineAdd, {
    title: "Sendspin enclosure",
    doneWhen: "A printed case holds the board.",
    repos: ["PANEL"],
    where: "working",
  });
  const base = h.call(c.issueCreate, { project: "PANEL", title: "Base", line: line.ref });
  const lid = h.call(c.issueCreate, { project: "PANEL", title: "Lid", line: line.ref });
  const pr = (number: number, title: string, issue: string, state: "open" | "draft" = "open") =>
    h.call(c.prUpsert, {
      repo: "vasc/homepanel",
      number,
      title,
      state,
      checks: "passing",
      headSha: `sha${number}`,
      issues: [issue],
    });
  const first = pr(14, "Print the base", base.ref);
  const second = pr(15, "Print the lid", lid.ref);
  const draft = pr(16, "Try a thinner lid", lid.ref, "draft");
  h.call(c.prUpsert, {
    repo: "vasc/homepanel",
    number: 13,
    title: "An old try",
    state: "merged",
    issues: [base.ref],
  });
  return { h, line, first, second, draft };
}

describe("a pull request ready to merge", () => {
  test("an agent says one is ready to merge, by its own judgment, and why; the line lists it first", () => {
    const { h, line, second } = lineWithPrs();
    const ready = h.call(c.prReadyToMerge, {
      ref: "vasc/homepanel#15",
      why: "Printed and fits; checks pass.",
    });
    expect(ready.ref).toBe(second.ref);
    expect(ready.readyBy).toBe("agent-a");
    expect(ready.readyWhy).toBe("Printed and fits; checks pass.");
    expect(ready.readySha).toBe("sha15");
    const shown = h.developer(c.lineShow, { ref: line.ref });
    // Only those still open, the ready one first, then the open ones, then the drafts; merged ones are history.
    expect(shown.prs.map((pr) => pr.number)).toEqual([15, 14, 16]);
    const home = h.developer(c.homeShow, {});
    expect(home.lines[line.ref]?.prs.map((pr) => pr.number)).toEqual([15, 14, 16]);
    const said = h.developer(c.feedList, { query: `ref:${second.ref}` });
    expect(said.events.some((event) => event.type === "pr.ready_to_merge")).toBe(true);
  });

  test("it can be taken back, and is found by its ref as well", () => {
    const { h, line, second } = lineWithPrs();
    h.call(c.prReadyToMerge, { ref: second.ref });
    const back = h.call(c.prReadyToMerge, { ref: second.ref, ready: false });
    expect(back.readyAt).toBeNull();
    expect(back.readyBy).toBeNull();
    expect(h.developer(c.lineShow, { ref: line.ref }).prs.map((pr) => pr.number)).toEqual([14, 15, 16]);
  });

  test("said again, it keeps when it was first said and takes the new words; taken back twice, it says so once", () => {
    const { h, second } = lineWithPrs();
    const first = h.call(c.prReadyToMerge, { ref: second.ref, why: "Checks pass." });
    h.setNow("2026-11-07T13:00:00.000Z");
    const again = h.call(c.prReadyToMerge, { ref: second.ref, why: "Checks pass; tried on the panel." });
    expect(again.readyAt).toBe(first.readyAt);
    expect(again.readyWhy).toBe("Checks pass; tried on the panel.");
    expect(again.version).toBeGreaterThan(first.version);
    const same = h.call(c.prReadyToMerge, { ref: second.ref, why: "Checks pass; tried on the panel." });
    expect(same.version).toBe(again.version);
    h.call(c.prReadyToMerge, { ref: second.ref, ready: false });
    h.call(c.prReadyToMerge, { ref: second.ref, ready: false });
    const types = h
      .developer(c.feedList, { query: `ref:${second.ref}` })
      .events.map((event) => event.type)
      .filter((type) => type === "pr.ready_to_merge" || type === "pr.not_ready_to_merge");
    expect(types.sort()).toEqual(["pr.not_ready_to_merge", "pr.ready_to_merge", "pr.ready_to_merge"]);
  });

  test("a sync from GitHub keeps the mark, with the commit it was given at, so a push after it shows", () => {
    const { h, second } = lineWithPrs();
    h.call(c.prReadyToMerge, { ref: second.ref });
    const pushed = h.call(c.prUpsert, {
      repo: "vasc/homepanel",
      number: 15,
      title: "Print the lid",
      state: "open",
      headSha: "sha15b",
    });
    expect(pushed.readyAt).not.toBeNull();
    expect(pushed.readySha).toBe("sha15");
    expect(pushed.headSha).toBe("sha15b");
  });
});

describe("refining a question already answered", () => {
  test("its options may change, but never so the one chosen is gone", () => {
    const h = harness();
    const asked = h.call(c.decisionAsk, {
      title: "Which board?",
      options: [
        { key: "a", label: "26 mm" },
        { key: "b", label: "30 mm" },
      ],
    });
    h.developer(c.decisionResolve, { ref: asked.ref, option: "a" });
    let refused: unknown = null;
    try {
      h.call(c.decisionUpdate, {
        ref: asked.ref,
        options: [
          { key: "b", label: "30 mm" },
          { key: "c", label: "34 mm" },
        ],
      });
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(OctoError);
    const kept = h.call(c.decisionUpdate, {
      ref: asked.ref,
      options: [
        { key: "a", label: "26 mm, the short board" },
        { key: "b", label: "30 mm" },
      ],
    });
    expect(kept.chosenOption).toBe("a");
    expect(kept.options.map((option) => option.key)).toEqual(["a", "b"]);
  });
});

describe("what to accept", () => {
  test("counts only what home shows: a case for done on a working line, not one on a line nobody works on", () => {
    const h = harness();
    const waiting = h.developer(c.lineAdd, { title: "Wall mount", doneWhen: "It hangs.", where: "up_next" });
    const working = h.developer(c.lineAdd, { title: "Enclosure", doneWhen: "It fits.", where: "working" });
    h.call(c.lineProposeDone, { ref: waiting.ref, why: "It hangs flush." });
    expect(h.developer(c.homeShow, {}).lines[waiting.ref]?.forYou ?? []).toEqual([]);
    h.call(c.lineProposeDone, { ref: working.ref, why: "It fits." });
    const home = h.developer(c.homeShow, {});
    expect(home.lines[working.ref]?.forYou.map((item) => item.kind)).toEqual(["done"]);
  });
});

describe("a task's place", () => {
  test("a blank one is no place: the task has none, and no nameless place is added", () => {
    const h = harness();
    h.developer(c.projectCreate, { key: "NET", name: "Network" });
    const line = h.developer(c.lineAdd, {
      title: "Remote access",
      doneWhen: "It connects.",
      repos: ["NET"],
      where: "working",
    });
    const task = h.call(c.taskFile, { title: "Log in to Tailscale", place: "   ", line: line.ref });
    expect(task.place).toBeNull();
    expect(h.developer(c.placeList, {}).map((place) => place.name)).toEqual([]);
  });
});
