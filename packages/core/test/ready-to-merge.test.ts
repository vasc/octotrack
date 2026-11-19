import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
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
