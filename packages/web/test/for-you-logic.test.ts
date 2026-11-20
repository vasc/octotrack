import { describe, expect, test } from "bun:test";
import type { HomeView } from "@octotrack/core/schemas";
import { decision, decisionCard, issue, line, lineHome } from "../src/design/fixtures.ts";
import {
  entriesOf,
  type Filter,
  filterAt,
  filterCounts,
  forYouPath,
  nextFilter,
  openEntry,
} from "../src/lib/forYou.ts";

const home: HomeView = {
  runner: { configured: false, cap: 1, dryRun: false },
  at: null,
  urgent: [decisionCard({ decision: decision({ ref: "D-9", urgentReason: "broken", line: "L-2" }) })],
  noLine: [decisionCard({ decision: decision({ ref: "D-7" }) })],
  lines: {
    "L-1": lineHome({
      forYou: [
        { kind: "done", line: "L-1", text: "It fits.", by: "panel", doneWhen: "It fits." },
        { kind: "question", card: decisionCard({ decision: decision({ ref: "D-1", line: "L-1" }) }) },
        { kind: "task", task: issue({ ref: "OCT-4", line: "L-1" }), frees: null },
      ],
    }),
    "L-2": lineHome({
      stepIn: true,
      stepInReason: "No agent took L-2.",
      stepInKind: "no_start_command",
      forYou: [{ kind: "question", card: decisionCard({ decision: decision({ ref: "D-2", line: "L-2" }) }) }],
    }),
  },
  working: [line({ ref: "L-1" }), line({ ref: "L-2" })],
  upNext: [],
  proposed: [
    line({ ref: "L-5", state: "proposed", urgentReason: "broken" }),
    line({ ref: "L-6", state: "proposed" }),
  ],
  tabled: [],
  doneLately: [],
  crews: {},
};

const refs = (filter: Filter, view = home) => entriesOf(view, filter).map((entry) => entry.ref);

describe("For you", () => {
  test("All is urgent first, then each working line in order, its Step in first, then proposals, then no line", () => {
    expect(refs("all")).toEqual([
      "D-9",
      "L-5",
      "done:L-1",
      "D-1",
      "OCT-4",
      "stepin:L-2",
      "D-2",
      "L-6",
      "D-7",
    ]);
  });

  test("each view holds what its count counts; an urgent proposal is also one to accept", () => {
    expect(refs("urgent")).toEqual(["D-9", "L-5"]);
    expect(refs("toAnswer")).toEqual(["D-1", "D-2", "D-7"]);
    expect(refs("toDo")).toEqual(["OCT-4"]);
    expect(refs("toAccept")).toEqual(["L-5", "done:L-1", "L-6"]);
    expect(refs("toStepIn")).toEqual(["stepin:L-2"]);
    expect(filterCounts(home)).toEqual({ all: 9, urgent: 2, toAnswer: 3, toDo: 1, toAccept: 3, toStepIn: 1 });
  });

  test("each entry knows its line, so its card can name it", () => {
    expect(entriesOf(home, "toAnswer").map((entry) => entry.line?.ref ?? null)).toEqual(["L-1", "L-2", null]);
  });

  test("what was put off goes to the bottom of the whole list, the last put off last", () => {
    const putOff = (ref: string, at: string) => ({
      kind: "question" as const,
      card: decisionCard({ decision: decision({ ref, line: "L-1", postponedAt: at }) }),
    });
    const later: HomeView = {
      ...home,
      lines: {
        ...home.lines,
        "L-1": lineHome({
          forYou: [putOff("D-1", "2026-11-20T10:00:00.000Z"), putOff("D-3", "2026-11-20T09:00:00.000Z")],
        }),
      },
    };
    expect(refs("toAnswer", later)).toEqual(["D-2", "D-7", "D-3", "D-1"]);
    expect(refs("all", later).slice(-2)).toEqual(["D-3", "D-1"]);
  });

  test("a view lives at its own address, and nothing else is For you", () => {
    expect(forYouPath("all")).toBe("/");
    expect(forYouPath("toAnswer")).toBe("/for-you/to-answer");
    expect(forYouPath("toStepIn", "stepin:L-2")).toBe("/for-you/to-step-in?item=stepin%3AL-2");
    expect(filterAt("/")).toBe("all");
    expect(filterAt("/for-you/to-do")).toBe("toDo");
    expect(filterAt("/for-you/urgent")).toBe("urgent");
    expect(filterAt("/for-you/everything")).toBeNull();
    expect(filterAt("/lines")).toBeNull();
  });

  test("the open entry is the one asked for; once it goes, the one after it; else the first", () => {
    const entries = entriesOf(home, "toAnswer");
    expect(openEntry(entries, "D-2")?.ref).toBe("D-2");
    expect(openEntry(entries, null)?.ref).toBe("D-1");
    // D-1 was answered: the one after it in the list as it was opens.
    const after = entries.filter((entry) => entry.ref !== "D-1");
    expect(openEntry(after, "D-1", ["D-1", "D-2", "D-7"])?.ref).toBe("D-2");
    // The last was answered: nothing comes after it, so the first.
    const lastGone = entries.filter((entry) => entry.ref !== "D-7");
    expect(openEntry(lastGone, "D-7", ["D-1", "D-2", "D-7"])?.ref).toBe("D-1");
    expect(openEntry([], "D-1")).toBeNull();
  });

  test("when a view is done, the next one on the rail that holds something", () => {
    const counts = { all: 4, urgent: 0, toAnswer: 0, toDo: 2, toAccept: 0, toStepIn: 2 };
    expect(nextFilter(counts, "toAnswer")).toBe("toDo");
    expect(nextFilter(counts, "toStepIn")).toBe("toDo");
    expect(nextFilter({ ...counts, toDo: 0, toStepIn: 0 }, "toAnswer")).toBeNull();
    expect(nextFilter(counts, "all")).toBeNull();
  });
});
