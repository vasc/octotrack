import { describe, expect, test } from "bun:test";
import { newBuild } from "../src/lib/build.ts";
import { suggest } from "../src/hooks/useSuggestions.ts";
import { validateQuery } from "../src/hooks/useFilter.ts";
import {
  dayLabel,
  dayWord,
  filterTerm,
  humanize,
  sinceText,
  whenText,
  splitRefs,
  timeAgo,
  timeLabel,
  toneOf,
} from "../src/lib/format.ts";
import { focusLabel, nextFocus } from "../src/lib/focus.ts";
import { forYouCounts, heldOnTabled, lineFacts, heldText, tellSummary, undoLines } from "../src/lib/lines.ts";
import { askedText, cantSummary, doneSummary, howClosed, isTask, taskOutcome } from "../src/lib/tasks.ts";
import { issueLinks } from "../src/lib/links.ts";
import { moreSinceSummary } from "../src/lib/log.ts";
import { doneWhenSaid, LINE_SAID } from "../src/lib/said.ts";
import { DEFAULT_APPEARANCE, PALETTES, readAppearance, tintBrowserBar } from "../src/lib/appearance.ts";
import { decision, decisionCard, event, issue, pendingChoice } from "../src/design/fixtures.ts";
import { answerWaiting } from "../src/hooks/useDecisionForm.ts";
import { closeEntity, navigate, openEntity, setParams } from "../src/lib/router.ts";

describe("suggest", () => {
  const dynamic = { project: ["OCT", "API"], actor: ["agent-a"] };

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

  test("says what is wrong without where, since the box shows the query", () => {
    expect(validateQuery("nope:1")).not.toMatch(/position|in: /);
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

  test("dayLabel decides the day in local time, as the times beside it are", () => {
    // Local dates, so this holds in any time zone: a quarter past midnight is today, not yesterday.
    const local = new Date(2026, 10, 7, 12, 0).getTime();
    expect(dayLabel(new Date(2026, 10, 7, 0, 15).toISOString(), local)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 6, 23, 45).toISOString(), local)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 10, 1, 23, 0).toISOString(), local)).toBe("2026-11-01");
  });

  test("whenText words a time as the boards do, in local time", () => {
    const local = new Date(2026, 10, 7, 12, 0).getTime();
    expect(whenText(new Date(2026, 10, 7, 7, 20).toISOString(), local)).toBe("at 07:20");
    expect(whenText(new Date(2026, 10, 4, 9, 0).toISOString(), local)).toBe("on Wednesday");
    expect(whenText(new Date(2026, 10, 10, 9, 0).toISOString(), local)).toBe("on Tuesday");
    expect(whenText(new Date(2026, 9, 1, 9, 0).toISOString(), local)).toBe("on 1 October");
    expect(whenText(new Date(2027, 1, 1, 9, 0).toISOString(), local)).toBe("on 1 February 2027");
    // A date alone, as a look-again date is kept, is that day wherever the viewer is.
    expect(whenText("2027-02-01", local)).toBe("on 1 February 2027");
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
  test("the time today, the weekday and time this past week, else the date", () => {
    const now = new Date(2026, 10, 14, 18, 0).getTime();
    expect(timeLabel(new Date(2026, 10, 14, 9, 52).toISOString(), now)).toBe("09:52");
    expect(timeLabel(new Date(2026, 10, 10, 9, 0).toISOString(), now)).toBe("Tue 09:00");
    // Older: the day and the month in few letters, so the log's time column stays narrow; another year says which.
    expect(timeLabel(new Date(2026, 9, 1, 9, 0).toISOString(), now)).toBe("1 Oct");
    expect(timeLabel(new Date(2025, 9, 1, 9, 0).toISOString(), now)).toBe("Oct 2025");
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
    expect(taskOutcome(issue({ outcome: "" }), {}, "")).toEqual({});
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
    expect(doneSummary(issue({ title: "Sweep the shed", outcome: "" }), {}, null)).toBe(
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
    expect(
      focusLabel({ kind: "task", task: issue({ ref: "OCT-7", title: "Measure the grip" }), frees: null }),
    ).toBe("Task OCT-7, Measure the grip");
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

describe("a line's items, for the line panel", () => {
  test("says what a waiting line holds, or nothing when it holds none", () => {
    expect(heldText({ questions: 1, tasks: 2 })).toBe("1 question, 2 tasks, released when it starts");
    expect(heldText({ questions: 0, tasks: 1 })).toBe("1 task, released when it starts");
    expect(heldText({ questions: 0, tasks: 0 })).toBeNull();
  });

  test("counts what waits on the developer by kind", () => {
    const task = { kind: "task" as const, task: issue(), frees: null };
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

describe("dayWord", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  test("today, yesterday, a weekday within the week, else the date", () => {
    expect(dayWord("2026-11-14T08:00:00.000Z", now)).toBe("today");
    expect(dayWord("2026-11-13T08:00:00.000Z", now)).toBe("yesterday");
    expect(dayWord("2026-11-10T09:00:00.000Z", now)).toBe("Tuesday");
    expect(dayWord("2026-10-01T09:00:00.000Z", now)).toBe("2026-10-01");
  });
});

describe("howClosed", () => {
  test("a task's closing, from its history, newest first: done, could not be done, or withdrawn and by whom", () => {
    const at = (type: string, actor: string, seq: number) => event({ seq, type, actor, ref: "OCT-1" });
    expect(howClosed([at("task.withdrawn", "octo.1", 3), at("issue.created", "octo.1", 1)])).toEqual({
      how: "withdrawn",
      by: "octo.1",
    });
    expect(howClosed([at("task.cant", "dev", 2)])).toEqual({ how: "cant", by: "dev" });
    expect(howClosed([at("task.done", "dev", 2)])).toEqual({ how: "done", by: "dev" });
    expect(howClosed([at("issue.created", "octo.1", 1)])).toBeNull();
  });
});

describe("moreSinceSummary", () => {
  const at = (ts: string) => ({ ts });
  test("there may be more newer than the summary only when every change loaded is newer and older ones remain", () => {
    expect(moreSinceSummary([at("2026-11-14T10:00"), at("2026-11-14T09:30")], "2026-11-14T09:00", 12)).toBe(
      true,
    );
    // The oldest loaded is already older than the summary: everything newer is here.
    expect(moreSinceSummary([at("2026-11-14T10:00"), at("2026-11-14T08:00")], "2026-11-14T09:00", 12)).toBe(
      false,
    );
    expect(moreSinceSummary([at("2026-11-14T10:00")], "2026-11-14T09:00", null)).toBe(false);
    // With no summary, every change counts, so any older page means more.
    expect(moreSinceSummary([at("2026-11-14T10:00")], null, 12)).toBe(true);
  });
});

describe("how a line's choices read in the Undo bar", () => {
  test("one wording for each, wherever it is made", () => {
    expect(LINE_SAID.start("Enclosure")).toBe("Starting Enclosure");
    expect(LINE_SAID.queue("Enclosure")).toBe("Moving Enclosure to up next");
    expect(LINE_SAID.reject("Enclosure")).toBe("Turning down Enclosure: not a line");
    expect(LINE_SAID.table("Enclosure")).toBe("Tabling Enclosure");
    expect(doneWhenSaid("Enclosure", true)).toBe("Accepting the new done when for Enclosure");
    expect(doneWhenSaid("Enclosure", false)).toBe("Keeping Enclosure's done when");
  });
});

describe("appearance", () => {
  test("eight themes, Paper first", () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual([
      "paper",
      "solarized",
      "gruvbox",
      "catppuccin",
      "rosepine",
      "nord",
      "everforest",
      "contrast",
    ]);
  });

  test("reads what was stored, and falls back to Paper following the system for anything else", () => {
    expect(readAppearance('{"palette":"nord","mode":"dark"}')).toEqual({ palette: "nord", mode: "dark" });
    // A theme that no longer exists, kept by a device from before, is Paper in the mode it kept.
    expect(readAppearance('{"palette":"forest","mode":"dark"}')).toEqual({ palette: "paper", mode: "dark" });
    expect(readAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(readAppearance("not json")).toEqual(DEFAULT_APPEARANCE);
    expect(readAppearance('{"palette":"neon","mode":"dark"}')).toEqual({ palette: "paper", mode: "dark" });
    expect(readAppearance('{"palette":"nord","mode":"dim"}')).toEqual({ palette: "nord", mode: "system" });
    expect(DEFAULT_APPEARANCE).toEqual({ palette: "paper", mode: "system" });
  });
});

describe("tintBrowserBar", () => {
  test("the phone's browser bar takes the page's ground, so it is the theme's and not a fixed dark", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#141413");
    document.head.append(meta);
    const root = document.createElement("div");
    root.style.backgroundColor = "rgb(215, 230, 245)";
    document.body.append(root);
    tintBrowserBar(root);
    expect(meta.getAttribute("content")).toBe("rgb(215, 230, 245)");
    root.remove();
    meta.remove();
  });

  test("with no ground to read, the bar keeps what it had", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#141413");
    document.head.append(meta);
    const root = document.createElement("div");
    document.body.append(root);
    tintBrowserBar(root);
    expect(meta.getAttribute("content")).toBe("#141413");
    root.remove();
    meta.remove();
  });
});

describe("newBuild", () => {
  const page = (...assets: string[]) =>
    `<!doctype html><head>${assets
      .map((asset) =>
        asset.endsWith(".css")
          ? `<link rel="stylesheet" crossorigin href="${asset}">`
          : `<script type="module" crossorigin src="${asset}"></script>`,
      )
      .join("")}</head>`;
  const loaded = ["/assets/index-A.js", "/assets/style-A.css"];

  test("names what the served page loads that this page did not, a new stylesheet alone included", () => {
    expect(newBuild(loaded, page("/assets/index-A.js", "/assets/style-B.css"))).toEqual([
      "/assets/style-B.css",
    ]);
    expect(newBuild(loaded, page("/assets/index-B.js", "/assets/style-A.css"))).toEqual([
      "/assets/index-B.js",
    ]);
  });

  test("is nothing while the served page loads what this page loaded, whatever this page loaded since", () => {
    expect(newBuild(loaded, page("/assets/index-A.js", "/assets/style-A.css"))).toEqual([]);
    expect(newBuild([...loaded, "/assets/MarkdownView-C.js"], page(...loaded))).toEqual([]);
  });

  test("is nothing when the served page is not a built one, such as an error page or a dev server's", () => {
    expect(newBuild(loaded, "<html>Bad gateway</html>")).toEqual([]);
    expect(newBuild([], '<script type="module" src="/src/main.tsx"></script>')).toEqual([]);
  });
});

describe("answerWaiting", () => {
  test("is the answer waiting on a question, never Later or Not urgent on it", () => {
    const later = pendingChoice({ id: 1, op: "decision.postpone", ref: "D-1" });
    const answer = pendingChoice({ id: 2, op: "decision.resolve", ref: "D-1" });
    const other = pendingChoice({ id: 3, op: "decision.resolve", ref: "D-2" });
    expect(answerWaiting([later], "D-1")).toBeUndefined();
    expect(answerWaiting([later, answer, other], "D-1")?.id).toBe(2);
    expect(answerWaiting([pendingChoice({ ...answer, state: "applied" })], "D-1")).toBeUndefined();
  });
});
