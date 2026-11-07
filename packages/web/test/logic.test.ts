import { describe, expect, test } from "bun:test";
import { suggest } from "../src/hooks/useSuggestions.ts";
import { validateQuery } from "../src/hooks/useFilter.ts";
import type { Decision } from "@octotrack/core/schemas";
import { decision } from "../src/design/fixtures.ts";
import type { Tone } from "../src/lib/format.ts";
import { dayLabel, deliveryOf, humanize, splitRefs, timeAgo, toneOf } from "../src/lib/format.ts";
import { closeEntity, navigate, openEntity, setParams } from "../src/lib/router.ts";

describe("deliveryOf", () => {
  const answered = {
    status: "decided" as const,
    requestedBy: "agent-a",
    decidedBy: "dev",
    decidedAt: "2026-11-07",
  };

  test("an open decision has nothing to deliver", () => {
    expect(deliveryOf(decision())).toBeNull();
  });

  test("nor does one the agent answered itself", () => {
    expect(deliveryOf(decision({ ...answered, decidedBy: "agent-a" }))).toBeNull();
  });

  const cases: readonly (readonly [Partial<Decision>, string, Tone])[] = [
    [{}, "not picked up", "warn"],
    [{ wakeError: "No adapter" }, "wake failed", "bad"],
    [{ pickedUpAt: "2026-11-07", pickedUpBy: "agent-a" }, "picked up", "info"],
    [{ pickedUpAt: "2026-11-07", reportStatus: "partial" }, "partly carried out", "warn"],
    [{ pickedUpAt: "2026-11-07", reportStatus: "done" }, "carried out", "good"],
  ];
  test.each(cases)("%j reads as %s", (state, label, tone) => {
    expect(deliveryOf(decision({ ...answered, ...state }))).toEqual({ label, tone });
  });
});

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
