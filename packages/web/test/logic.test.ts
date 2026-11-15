import { describe, expect, test } from "bun:test";
import { suggest } from "../src/hooks/useSuggestions.ts";
import { validateQuery } from "../src/hooks/useFilter.ts";
import {
  dayLabel,
  filterTerm,
  humanize,
  sinceText,
  splitRefs,
  timeAgo,
  timeLabel,
  toneOf,
} from "../src/lib/format.ts";
import { focusLabel, nextFocus } from "../src/lib/focus.ts";
import {
  forYouCounts,
  heldOnTabled,
  lineFacts,
  linePosition,
  tellSummary,
  undoLines,
} from "../src/lib/lines.ts";
import { askedText, cantSummary, doneSummary, isTask, taskOutcome } from "../src/lib/tasks.ts";
import { issueLinks } from "../src/lib/links.ts";
import { decision, decisionCard, issue } from "../src/design/fixtures.ts";
import { closeEntity, navigate, openEntity, setParams } from "../src/lib/router.ts";

describe("suggest", () => {
  const dynamic = { project: ["OCT", "API"], actor: ["claude-a"] };

  test("completes field names", () => {
    expect(suggest("sta", {}).map((item) => item.term)).toEqual(["status:", "state:"]);
    expect(suggest("kind:decision pri", {}).map((item) => item.term)).toEqual(["priority:"]);
  });

  test("offers known values, static and from the data", () => {
    expect(suggest("kind:is", {}).map((item) => item.term)).toEqual(["kind:issue"]);
    expect(suggest("project:", dynamic).map((item) => item.term)).toEqual(["project:OCT", "project:API"]);
  });

  test("keeps negation and earlier values in a comma list", () => {
    expect(suggest("-kind:dr", {}).map((item) => item.term)).toEqual(["-kind:drift"]);
    expect(suggest("project:OCT,A", dynamic).map((item) => item.term)).toEqual(["project:OCT,API"]);
  });

  test("offers nothing for an empty word, a finished value or an unknown field", () => {
    expect(suggest("", {})).toEqual([]);
    expect(suggest("kind:issue ", {})).toEqual([]);
    expect(suggest("kind:issue", {})).toEqual([]);
    expect(suggest("zzz:", {})).toEqual([]);
  });
});

describe("validateQuery", () => {
  test("passes good queries and explains bad ones", () => {
    expect(validateQuery("kind:decision")).toBeNull();
    expect(validateQuery("")).toBeNull();
    expect(validateQuery("nope:1")).toContain("Unknown field");
  });
});

describe("format", () => {
  const now = Date.parse("2026-11-07T12:00:00.000Z");

  test("timeAgo", () => {
    expect(timeAgo("2026-11-07T11:59:30.000Z", now)).toBe("now");
    expect(timeAgo("2026-11-07T11:30:00.000Z", now)).toBe("30m");
    expect(timeAgo("2026-11-07T09:00:00.000Z", now)).toBe("3h");
    expect(timeAgo("2026-11-05T12:00:00.000Z", now)).toBe("2d");
    expect(timeAgo("2026-01-01T12:00:00.000Z", now)).toBe("2026-01-01");
  });

  test("dayLabel", () => {
    expect(dayLabel("2026-11-07T01:00:00.000Z", now)).toBe("Today");
    expect(dayLabel("2026-11-06T23:00:00.000Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-01T23:00:00.000Z", now)).toBe("2026-11-01");
  });

  test("tones and names", () => {
    expect(toneOf("failing")).toBe("bad");
    expect(toneOf("merged")).toBe("good");
    expect(toneOf("whatever")).toBe("neutral");
    expect(humanize("in_progress")).toBe("in progress");
  });

  test("splitRefs finds every kind of ref", () => {
    const refs = (text: string) =>
      splitRefs(text)
        .filter((piece) => piece.isRef)
        .map((piece) => piece.text);
    expect(refs("D-1 M-2 I-3 U-4 OCT-5 PR-6 DR-7 API2-8")).toEqual([
      "D-1",
      "M-2",
      "I-3",
      "U-4",
      "OCT-5",
      "PR-6",
      "DR-7",
      "API2-8",
    ]);
    expect(refs("x-1 utf-8 D- -3")).toEqual([]);
    expect(
      splitRefs("see D-1 now")
        .map((piece) => piece.text)
        .join(""),
    ).toBe("see D-1 now");
    expect(splitRefs("")).toEqual([]);
  });
});

describe("router", () => {
  test("params can be set and cleared while keeping the others", () => {
    navigate("/issues?q=a");
    setParams({ view: "Mine" });
    expect(window.location.search).toBe("?q=a&view=Mine");
    setParams({ q: null, view: "" });
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/issues");
  });

  test("the inspector is a URL parameter", () => {
    navigate("/");
    openEntity("D-1");
    expect(window.location.search).toBe("?ref=D-1");
    closeEntity();
    expect(window.location.search).toBe("");
  });
});

describe("nextFocus", () => {
  test("stays put when something arrives, even ahead of it", () => {
    expect(nextFocus("D-2", ["D-2", "D-3"], ["D-9", "D-2", "D-3"], "D-9")).toBe("D-2");
  });

  test("moves to the next item when its own is gone, else the one before, else where it starts", () => {
    expect(nextFocus("D-2", ["D-1", "D-2", "D-3"], ["D-1", "D-3"], "D-1")).toBe("D-3");
    expect(nextFocus("D-3", ["D-1", "D-2", "D-3"], ["D-1", "D-2"], "D-1")).toBe("D-2");
    expect(nextFocus("D-3", ["D-3"], ["D-7"], "D-7")).toBe("D-7");
  });

  test("starts where it is told to, when that is there, else at the first item", () => {
    expect(nextFocus(null, [], ["D-1", "D-2"], "D-2")).toBe("D-2");
    expect(nextFocus(null, [], ["D-1", "D-2"], "D-5")).toBe("D-1");
    expect(nextFocus(null, [], [], null)).toBeNull();
  });
});

describe("timeLabel", () => {
  test("the time today, the weekday this past week, else the date", () => {
    const now = new Date(2026, 10, 14, 18, 0).getTime();
    expect(timeLabel(new Date(2026, 10, 14, 9, 52).toISOString(), now)).toBe("09:52");
    expect(timeLabel(new Date(2026, 10, 10, 9, 0).toISOString(), now)).toBe("Tue");
    expect(timeLabel("2026-10-01T09:00:00.000Z", now)).toBe("2026-10-01");
  });
});

describe("filterTerm", () => {
  test("quotes a value with a space, as an agent named before names were narrowed may have, and its quotes", () => {
    expect(filterTerm("actor", "panel")).toBe("actor:panel");
    expect(filterTerm("actor", "my agent")).toBe('actor:"my agent"');
    expect(filterTerm("actor", 'say "hi"')).toBe('actor:"say \\"hi\\""');
  });
});

describe("heldOnTabled", () => {
  const held = (questions: number, tasks: number) => ({ held: { questions, tasks } });

  test("says nothing when the tabled lines hold nothing", () => {
    expect(heldOnTabled({ tabled: [{ ref: "L-1" }], lines: { "L-1": held(0, 0) } })).toBeUndefined();
  });

  test("adds up every tabled line, and only tabled ones", () => {
    expect(
      heldOnTabled({
        tabled: [{ ref: "L-1" }, { ref: "L-2" }, { ref: "L-9" }],
        lines: { "L-1": held(1, 0), "L-2": held(1, 1), "L-3": held(5, 5) },
      }),
    ).toBe("2 questions and 1 task held");
  });

  test("names only what there is", () => {
    expect(heldOnTabled({ tabled: [{ ref: "L-1" }], lines: { "L-1": held(0, 3) } })).toBe("3 tasks held");
  });
});

describe("taskOutcome", () => {
  const named = issue({ outcome: "In mm", fields: ["Length", "Holes"] });

  test("a task with named outcomes is ready only with every one filled, and sends them trimmed with any note", () => {
    expect(taskOutcome(named, { Length: "41" }, "")).toBeNull();
    expect(taskOutcome(named, { Length: "41", Holes: " " }, "")).toBeNull();
    expect(taskOutcome(named, { Length: " 41 ", Holes: "38" }, "")).toEqual({
      values: { Length: "41", Holes: "38" },
    });
    expect(taskOutcome(named, { Length: "41", Holes: "38", Old: "x" }, " Warped ")).toEqual({
      values: { Length: "41", Holes: "38" },
      result: "Warped",
    });
  });

  test("a task with one outcome needs words; one of the developer's own needs none", () => {
    expect(taskOutcome(issue({ outcome: "Grams" }), {}, " ")).toBeNull();
    expect(taskOutcome(issue({ outcome: "Grams" }), {}, " 212 g ")).toEqual({ result: "212 g" });
    expect(taskOutcome(issue({ outcome: "" }), {}, "")).toEqual({ result: "Done" });
  });
});

describe("whether a line waits on the developer", () => {
  // L-1 has a question for the developer and work its agents can do; all of L-2's work waits on the developer.
  const enclosure = { ref: "L-1", title: "Enclosure" };
  const mount = { ref: "L-2", title: "Mount" };
  const lines = [enclosure, mount];
  const facts = { "L-1": { waitingOnYou: false }, "L-2": { waitingOnYou: true } };

  test("the roster says so only when all of a line's work waits, and says nothing of a line it does not know", () => {
    expect(lineFacts(lines, facts, "L-1")).toEqual({ lineTitle: "Enclosure", waitsOnYou: false });
    expect(lineFacts(lines, facts, "L-2")).toEqual({ lineTitle: "Mount", waitsOnYou: true });
    expect(lineFacts(lines, facts, "L-9")).toEqual({});
    expect(lineFacts(lines, facts, null)).toEqual({});
  });

  test("so does the Undo bar", () => {
    expect(undoLines({ working: [enclosure], upNext: [mount], lines: facts })).toEqual({
      "L-1": { title: "Enclosure", waitsOnYou: false },
      "L-2": { title: "Mount", waitsOnYou: true },
    });
  });
});

describe("sinceText", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  test("reads after a verb at every age", () => {
    expect(sinceText("2026-11-14T11:59:40.000Z", now)).toBe("just now");
    expect(sinceText("2026-11-14T11:55:00.000Z", now)).toBe("5m ago");
    expect(sinceText("2026-11-12T12:00:00.000Z", now)).toBe("2d ago");
    expect(sinceText("2026-10-01T12:00:00.000Z", now)).toBe("on 2026-10-01");
  });
});

describe("askedText", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  test("says when a task was asked, or re-confirmed if later", () => {
    expect(askedText({ createdAt: "2026-11-14T10:00:00.000Z", confirmedAt: null }, now)).toBe("asked 2h ago");
    expect(
      askedText({ createdAt: "2026-11-01T10:00:00.000Z", confirmedAt: "2026-11-14T11:59:50.000Z" }, now),
    ).toBe("re-confirmed just now");
  });
});

describe("how a task's choices read in the Undo bar", () => {
  const task = issue({ ref: "OCT-1", title: "Measure the grip", outcome: "In mm" });

  test("Done says what is sent and to which line, as it happens", () => {
    expect(doneSummary(task, { result: "26 mm" }, "Sendspin enclosure")).toBe(
      'Sending "26 mm" to Sendspin enclosure',
    );
    expect(
      doneSummary(
        task,
        { values: { Length: "41 mm", Holes: "38 mm" }, result: "Warped" },
        "Sendspin enclosure",
      ),
    ).toBe('Sending "Length 41 mm, Holes 38 mm" to Sendspin enclosure');
    expect(doneSummary(task, { result: "26 mm" }, null)).toBe('Sending "26 mm" for OCT-1');
    expect(doneSummary(issue({ title: "Sweep the shed", outcome: "" }), { result: "Done" }, null)).toBe(
      'Marking "Sweep the shed" done',
    );
  });

  test("Can't do it says it closes the task as not done, and why", () => {
    expect(cantSummary(task, "No calipers")).toBe("Closing OCT-1 as not done: No calipers");
  });
});

describe("focusLabel", () => {
  test("names each kind of item that focus can move to", () => {
    const card = decisionCard({ decision: decision({ ref: "D-7", title: "Which board?" }) });
    expect(focusLabel({ kind: "question", card })).toBe("Question D-7, Which board?");
    expect(focusLabel({ kind: "task", task: issue({ ref: "OCT-7", title: "Measure the grip" }) })).toBe(
      "Task OCT-7, Measure the grip",
    );
    expect(
      focusLabel(
        { kind: "done", line: "L-1", text: "It fits", by: "panel", doneWhen: "It holds" },
        "Enclosure",
      ),
    ).toBe("Proposed as done: Enclosure");
    expect(
      focusLabel(
        { kind: "done_when", line: "L-1", text: "New", by: "panel", was: "Old", why: null },
        "Enclosure",
      ),
    ).toBe("A new done when proposed: Enclosure");
  });
});

describe("issueLinks", () => {
  const link = (fromRef: string, rel: "blocks" | "relates", toRef: string) => ({
    fromRef,
    rel,
    toRef,
    createdAt: "",
    createdBy: "",
  });

  test("what an issue frees and what it waits on, from its links in both directions", () => {
    const links = [
      link("OCT-2", "blocks", "OCT-5"),
      link("OCT-1", "blocks", "OCT-2"),
      link("OCT-2", "relates", "OCT-9"),
    ];
    expect(issueLinks("OCT-2", links)).toEqual({ frees: ["OCT-5"], waitsOn: ["OCT-1"] });
    expect(issueLinks("OCT-9", links)).toEqual({ frees: [], waitsOn: [] });
  });
});

describe("isTask", () => {
  test("a task is an issue for the developer with something to report", () => {
    expect(isTask(issue({ assignee: "dev", outcome: "In mm" }))).toBe(true);
    expect(isTask(issue({ assignee: "dev", outcome: "" }))).toBe(true);
    expect(isTask(issue({ assignee: "dev", outcome: null }))).toBe(false);
    expect(isTask(issue({ assignee: "panel", outcome: "In mm" }))).toBe(false);
  });
});

describe("a line's place and its items, for the line panel", () => {
  const order = [
    { ref: "L-1", title: "Enclosure" },
    { ref: "L-2", title: "Mount" },
  ];

  test("says where a line stands in the order, or nothing for one outside it", () => {
    expect(linePosition(order, "L-2")).toBe("Line 2 of 2");
    expect(linePosition(order, "L-9")).toBeNull();
  });

  test("counts what waits on the developer by kind", () => {
    const task = { kind: "task" as const, task: issue() };
    const question = { kind: "question" as const, card: decisionCard() };
    expect(forYouCounts([task, question, task])).toEqual({ questions: 1, tasks: 2 });
  });

  test("a Tell says whom it reaches, and a nudge when it is empty", () => {
    expect(tellSummary("whoever holds OCT-1", "Try the 40 mm one")).toBe(
      "Telling whoever holds OCT-1: Try the 40 mm one",
    );
    expect(tellSummary("Enclosure's owner", "")).toBe("Nudging Enclosure's owner");
  });
});
