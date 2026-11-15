import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contracts } from "@octotrack/core";
import { Args, parse, parseDuration, quoteValue, UsageError } from "../src/args.ts";
import { parseOption } from "../src/commands/decisions.ts";
import { normalizeRelation } from "../src/commands/network.ts";
import { buildSpec } from "../src/commands/observe.ts";
import { queryFrom } from "../src/commands/shared.ts";
import { AGENT_GUIDE } from "../src/guide.ts";
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

describe("repo, the word lines use", () => {
  test("octo repo create, list and update are octo project's, which keep working", () => {
    for (const word of ["create", "list", "update"]) {
      const repo = resolveCommand(["repo", word, "OCT"]);
      const project = resolveCommand(["project", word, "OCT"]);
      expect(repo?.command.ops).toEqual(project?.command.ops ?? []);
    }
    expect(resolveCommand(["repo", "checkout", "OCT", "/src/oct"])?.command.ops).toEqual(["repo.checkout"]);
  });
});

describe("the CLI says repo where it used to say project", () => {
  test("in the guide, in every command's help, and in what pr sync tells you to run", async () => {
    expect(AGENT_GUIDE).not.toMatch(/\bproject:|octo project/);
    const words = COMMANDS.filter((command) => command.path[0] !== "project").flatMap((command) => [
      command.summary,
      ...(command.examples ?? []),
      ...Object.values(command.options ?? {}).map((spec) => spec.description),
    ]);
    expect(words.filter((text) => /\bproject:|octo project|a project names/.test(text))).toEqual([]);
    const network = await Bun.file(join(import.meta.dir, "../src/commands/network.ts")).text();
    expect(network).not.toContain("octo project");
    expect(network).toContain("octo repo update <KEY> --repo owner/name");
  });

  test("in every option outside octo project: --repo, with --project kept as an alias (fifth audit, B22)", () => {
    const options = COMMANDS.filter((command) => command.path[0] !== "project").flatMap((command) =>
      Object.entries(command.options ?? {}).map(
        ([name, spec]) => [command.path.join(" "), name, spec] as const,
      ),
    );
    expect(options.filter(([, name]) => name === "project").map(([path]) => path)).toEqual([]);
    expect(
      options
        .filter(([, , spec]) => /\bproject\b/i.test(spec.description))
        .map(([path, name]) => `${path} --${name}`),
    ).toEqual([]);
    expect(AGENT_GUIDE).not.toMatch(/ -p [A-Z]/);
    for (const path of [["issue", "create"], ["issue", "list"], ["next"], ["pr", "list"]]) {
      const options = resolveCommand([...path])?.command.options ?? {};
      expect(parse(["--project", "PANEL"], options).list("repo")).toEqual(["PANEL"]);
      expect(parse(["-p", "PANEL"], options).list("repo")).toEqual(["PANEL"]);
      expect(parse(["--project=PANEL"], options).list("repo")).toEqual(["PANEL"]);
    }
  });
});

describe("D14's words, beside the older ones", () => {
  const opsOf = (words: readonly string[]) => resolveCommand(words)?.command.ops;

  test.each([
    [
      ["question", "ask", "Which?"],
      ["decision", "ask", "Which?"],
    ],
    [
      ["question", "resolve", "D-1", "a"],
      ["decision", "resolve", "D-1", "a"],
    ],
    [
      ["question", "record", "Use X"],
      ["decision", "record", "Use X"],
    ],
    [
      ["question", "later", "D-1"],
      ["decision", "postpone", "D-1"],
    ],
    [
      ["question", "not-urgent", "D-1"],
      ["decision", "not-urgent", "D-1"],
    ],
    [
      ["question", "withdraw", "D-1"],
      ["decision", "withdraw", "D-1"],
    ],
    [
      ["line", "retry", "L-1"],
      ["runner", "retry", "L-1"],
    ],
    [
      ["summary", "write", "L-1"],
      ["line", "summarize", "L-1"],
    ],
    [
      ["tell", "L-1", "hello"],
      ["line", "tell", "L-1", "hello"],
    ],
    [
      ["done-when", "set", "L-1", "It works."],
      ["line", "done-when", "L-1", "It works."],
    ],
  ])("%p is %p", (alias, original) => {
    expect(opsOf(alias)).toBeDefined();
    expect(opsOf(alias)).toEqual(opsOf(original) ?? []);
    expect(resolveCommand(alias)?.rest).toEqual(resolveCommand(original)?.rest ?? []);
  });

  test("done when is accepted or kept, and an answer changed, each in one word", () => {
    expect(opsOf(["done-when", "accept", "L-1"])).toEqual([contracts.lineDoneWhenAnswer.name]);
    expect(opsOf(["done-when", "reject", "L-1"])).toEqual([contracts.lineDoneWhenAnswer.name]);
    expect(opsOf(["question", "change", "D-1", "b"])).toEqual([contracts.decisionResolve.name]);
  });

  test("every decision command has its question name", () => {
    const decisions = COMMANDS.filter((command) => command.path[0] === "decision");
    for (const command of decisions) {
      expect(opsOf(["question", ...command.path.slice(1)])).toEqual(command.ops);
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

describe("output reaches a pipe whole", () => {
  test("nothing in the CLI reads process.stdout, which in Bun makes console.log drop what a full pipe cannot take", () => {
    const source = join(import.meta.dir, "../src");
    const readers = [...new Bun.Glob("**/*.ts").scanSync(source)].filter((file) =>
      /process\.stdout/.test(
        readFileSync(join(source, file), "utf8")
          .split("\n")
          .filter((line) => !line.trim().startsWith("//"))
          .join("\n"),
      ),
    );
    expect(readers).toEqual([]);
  });
});
