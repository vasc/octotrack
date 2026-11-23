import { describe, expect, test } from "bun:test";
import { type GhPr, mapChecks, mapGhPr, selectRelevant } from "../src/gh.ts";

const base: GhPr = {
  number: 7,
  title: "Fix OCT-3",
  body: null,
  url: "https://github.com/acme/app/pull/7",
  state: "OPEN",
  isDraft: false,
  headRefName: "fix/oct-3",
  baseRefName: "main",
  headRefOid: "abc",
  author: { login: "dev" },
  additions: 1,
  deletions: 2,
  reviewDecision: "",
  mergeable: "MERGEABLE",
  mergedAt: null,
  closedAt: null,
  updatedAt: "2026-11-07T00:00:00Z",
  statusCheckRollup: null,
};

describe("mapping gh output", () => {
  test.each([
    [null, "none"],
    [[], "none"],
    [[{ status: "COMPLETED", conclusion: "SUCCESS" }], "passing"],
    [[{ status: "COMPLETED", conclusion: "NEUTRAL" }, { state: "SUCCESS" }], "passing"],
    [[{ status: "IN_PROGRESS", conclusion: null }], "pending"],
    [[{ state: "PENDING" }], "pending"],
    [
      [
        { status: "COMPLETED", conclusion: "SUCCESS" },
        { status: "COMPLETED", conclusion: "FAILURE" },
      ],
      "failing",
    ],
    [[{ status: "IN_PROGRESS" }, { state: "ERROR" }], "failing"],
  ] as const)("checks %j become %s", (items, expected) => {
    expect(mapChecks(items === null ? null : [...items])).toBe(expected);
  });

  test("state, draft, review and mergeable", () => {
    expect(mapGhPr("acme/app", base)).toMatchObject({
      repo: "acme/app",
      state: "open",
      review: "none",
      mergeable: "clean",
      author: "dev",
      body: "",
    });
    expect(mapGhPr("a/b", { ...base, isDraft: true }).state).toBe("draft");
    expect(mapGhPr("a/b", { ...base, state: "MERGED" }).state).toBe("merged");
    expect(mapGhPr("a/b", { ...base, state: "CLOSED" }).state).toBe("closed");
    expect(mapGhPr("a/b", { ...base, reviewDecision: "APPROVED" }).review).toBe("approved");
    expect(mapGhPr("a/b", { ...base, reviewDecision: "CHANGES_REQUESTED" }).review).toBe("changes_requested");
    expect(mapGhPr("a/b", { ...base, reviewDecision: "REVIEW_REQUIRED" }).review).toBe("requested");
    expect(mapGhPr("a/b", { ...base, mergeable: "CONFLICTING" }).mergeable).toBe("conflicting");
    expect(mapGhPr("a/b", { ...base, mergeable: "UNKNOWN" }).mergeable).toBe("unknown");
    expect(mapGhPr("a/b", { ...base, author: null }).author).toBe("unknown");
  });

  test("keeps open PRs and recently finished ones, and drops old history", () => {
    const now = Date.parse("2026-11-07T00:00:00Z");
    const kept = selectRelevant(
      [
        { ...base, number: 1, state: "OPEN", updatedAt: "2020-01-01T00:00:00Z" },
        { ...base, number: 2, state: "MERGED", updatedAt: "2026-11-05T00:00:00Z" },
        { ...base, number: 3, state: "MERGED", updatedAt: "2026-01-01T00:00:00Z" },
      ],
      now,
    );
    expect(kept.map((pr) => pr.number)).toEqual([1, 2]);
  });

  test("a PR we still think is open is kept however old it is, or it would stay open forever", () => {
    const now = Date.parse("2026-11-07T00:00:00Z");
    const old = { ...base, number: 3, state: "MERGED", updatedAt: "2026-01-01T00:00:00Z" };
    expect(selectRelevant([old], now)).toEqual([]);
    expect(selectRelevant([old], now, [3]).map((pr) => pr.number)).toEqual([3]);
  });
});
