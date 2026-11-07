import { describe, expect, test } from "bun:test";
import { contracts } from "@octotrack/core";
import { Args, parse, parseDuration, quoteValue, UsageError } from "../src/args.ts";
import { parseOption } from "../src/commands/decisions.ts";
import { normalizeRelation } from "../src/commands/network.ts";
import { buildSpec } from "../src/commands/observe.ts";
import { queryFrom } from "../src/commands/shared.ts";
import { COMMANDS, resolveCommand } from "../src/registry.ts";

describe("every operation is reachable from the CLI", () => {
  test("no operation lacks a command", () => {
    const covered = new Set(COMMANDS.flatMap((command) => command.ops));
    const missing = Object.values(contracts)
      .map((contract) => contract.name)
      .filter((name) => !covered.has(name));
    expect(missing).toEqual([]);
  });

  test("commands only claim operations that exist", () => {
    const real = new Set(Object.values(contracts).map((contract) => contract.name));
    const invented = COMMANDS.flatMap((command) => command.ops).filter((name) => !real.has(name));
    expect(invented).toEqual([]);
  });

  test("command paths are unique", () => {
    const paths = COMMANDS.map((command) => command.path.join(" "));
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("every command that takes options documents them", () => {
    for (const command of COMMANDS) {
      for (const spec of Object.values(command.options ?? {})) expect(spec.description).not.toBe("");
    }
  });
});

describe("command resolution", () => {
  test("longest path wins, and positionals are not mistaken for subcommands", () => {
    expect(resolveCommand(["watch", "start"])?.command.path).toEqual(["watch", "start"]);
    expect(resolveCommand(["watch", "D-3"])?.command.path).toEqual(["watch"]);
    expect(resolveCommand(["issue", "list"])?.command.path).toEqual(["issue", "list"]);
    expect(resolveCommand(["issue"])).toBeNull();
    expect(resolveCommand(["nope"])).toBeNull();
  });
});

describe("argument helpers", () => {
  test("durations", () => {
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("30m")).toBe(1_800_000);
    expect(parseDuration("2h")).toBe(7_200_000);
    expect(parseDuration("250ms")).toBe(250);
    expect(parseDuration("5")).toBe(5000);
    expect(() => parseDuration("soon")).toThrow(UsageError);
  });

  test("options", () => {
    expect(parseOption("a=Use A")).toEqual({ key: "a", label: "Use A" });
    expect(parseOption("a=Use A::Because reasons")).toEqual({
      key: "a",
      label: "Use A",
      description: "Because reasons",
    });
    expect(parseOption("a=x=y")).toEqual({ key: "a", label: "x=y" });
    expect(() => parseOption("nokey")).toThrow(UsageError);
    expect(() => parseOption("=label")).toThrow(UsageError);
  });

  test("relations that read backwards are flipped", () => {
    expect(normalizeRelation("A", "blocked-by", "B")).toEqual({ from: "B", rel: "blocks", to: "A" });
    expect(normalizeRelation("A", "depends-on", "B")).toEqual({ from: "B", rel: "blocks", to: "A" });
    expect(normalizeRelation("A", "implemented-by", "B")).toEqual({ from: "B", rel: "implements", to: "A" });
    expect(normalizeRelation("A", "derived-from", "B")).toEqual({ from: "A", rel: "derived_from", to: "B" });
  });

  test("flags and positional text combine into a query, quoted when needed", () => {
    const args = new Args(["ready:true"], { project: ["OCT", "API"], label: ["needs review"] });
    expect(queryFrom(args, ["project", "label"])).toBe('ready:true project:OCT,API label:"needs review"');
    expect(queryFrom(new Args([], {}))).toBeUndefined();
    expect(quoteValue('a"b c')).toBe('"a\\"b c"');
  });

  test("unknown flags are usage errors", () => {
    expect(() => parse(["--nope"], {})).toThrow(UsageError);
  });

  test("a watch spec is built from refs and clauses", () => {
    const args = new Args(["D-1"], {
      until: ["a:b"],
      "until-none": ["c:d"],
      on: ["e:f"],
      all: true,
      count: "2",
    });
    expect(buildSpec(args)).toEqual({
      require: "all",
      clauses: [
        { type: "event", query: "ref:D-1", count: 2 },
        { type: "event", query: "e:f", count: 2 },
        { type: "state", query: "a:b", mode: "exists" },
        { type: "state", query: "c:d", mode: "none" },
      ],
    });
    expect(() => buildSpec(new Args([], {}))).toThrow("Say what to watch");
  });
});
