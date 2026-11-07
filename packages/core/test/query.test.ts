import { describe, expect, test } from "bun:test";
import { OctoError } from "../src/errors.ts";
import { type MatchEnv, matchQuery, parseQuery, type QueryDoc, refsInQuery } from "../src/query/index.ts";

const env: MatchEnv = {
  now: "2026-11-07T12:00:00.000Z",
  linkedRefs: (ref) => new Set(ref === "OCT-1" ? ["D-1"] : []),
};

const doc: QueryDoc = {
  ref: "D-1",
  time: "2026-11-07T10:00:00.000Z",
  text: "Pick a Database engine",
  fields: {
    kind: ["decision"],
    ref: ["D-1", "OCT-1"],
    status: ["open"],
    project: ["OCT"],
    event: ["decision.requested"],
    label: ["storage", "backend"],
  },
};

function matches(query: string): boolean {
  return matchQuery(parseQuery(query), doc, env);
}

describe("query language", () => {
  test("an empty query matches everything", () => {
    expect(matches("")).toBe(true);
    expect(matches("   ")).toBe(true);
  });

  test("adjacent terms are AND", () => {
    expect(matches("kind:decision status:open")).toBe(true);
    expect(matches("kind:decision status:decided")).toBe(false);
  });

  test("commas are OR within a field", () => {
    expect(matches("status:decided,open")).toBe(true);
    expect(matches("status:decided,withdrawn")).toBe(false);
  });

  test("OR and parentheses", () => {
    expect(matches("status:decided OR kind:decision")).toBe(true);
    expect(matches("(status:decided OR status:open) kind:decision")).toBe(true);
    expect(matches("(status:decided OR status:withdrawn) kind:decision")).toBe(false);
  });

  test("negation with - and NOT", () => {
    expect(matches("-status:decided")).toBe(true);
    expect(matches("-status:open")).toBe(false);
    expect(matches("NOT status:open")).toBe(false);
    expect(matches("-(status:open OR status:decided)")).toBe(false);
  });

  test("globs", () => {
    expect(matches("event:decision.*")).toBe(true);
    expect(matches("event:issue.*")).toBe(false);
  });

  test("free text is case insensitive and quotes keep spaces", () => {
    expect(matches("database")).toBe(true);
    expect(matches('"pick a database"')).toBe(true);
    expect(matches('"database pick"')).toBe(false);
  });

  test("a bare ref means ref:", () => {
    expect(matches("D-1")).toBe(true);
    expect(matches("oct-1")).toBe(true);
    expect(matches("D-2")).toBe(false);
    expect(refsInQuery(parseQuery("D-1 OR OCT-2"))).toEqual(["D-1", "OCT-2"]);
  });

  test("none matches a missing field", () => {
    expect(matches("assignee:none")).toBe(true);
    expect(matches("project:none")).toBe(false);
  });

  test("since and before accept durations and dates", () => {
    expect(matches("since:3h")).toBe(true);
    expect(matches("since:1h")).toBe(false);
    expect(matches("before:1h")).toBe(true);
    expect(matches("since:2026-11-07")).toBe(true);
  });

  test("linked: follows the dependency network", () => {
    expect(matches("linked:OCT-1")).toBe(true);
    expect(matches("linked:OCT-2")).toBe(false);
  });

  test.each([
    ["nonsense:1", "Unknown field"],
    ["status:", "no value"],
    ["(status:open", "Unclosed"],
    ['"unterminated', "Unterminated"],
    ["status:open)", "Unexpected"],
  ])("rejects %s with a useful message", (query, message) => {
    expect(() => parseQuery(query)).toThrow(message);
    try {
      parseQuery(query);
    } catch (error) {
      expect(error).toBeInstanceOf(OctoError);
    }
  });
});
