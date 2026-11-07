#!/usr/bin/env bun
import { OctoError } from "@octotrack/core";
import { serverUrl } from "@octotrack/server/paths";
import { ZodError } from "zod";
import { type OptionSpec, type OptionSpecs, parse, UsageError } from "./args.ts";
import { ConnectionError, OctoClient, RemoteError } from "./client.ts";
import { type Command, makeOutput } from "./command.ts";
import { commandsUnder, COMMANDS, resolveCommand } from "./registry.ts";

const EXIT_ERROR = 1;
const EXIT_USAGE = 2;
const EXIT_UNREACHABLE = 3;

const GLOBAL_OPTIONS: OptionSpecs = {
  json: { type: "boolean", description: "JSON output. The default when not in a terminal" },
  text: { type: "boolean", description: "Text output. The default in a terminal" },
  agent: { type: "string", description: "Who is acting. Default: $OCTO_AGENT" },
  help: { type: "boolean", short: "h", description: "Show help" },
};

function optionLine(name: string, spec: OptionSpec): string {
  const short = spec.short === undefined ? "    " : `-${spec.short}, `;
  const value = spec.type === "string" ? " <value>" : "";
  return `  ${short}--${name}${value}\n        ${spec.description}`;
}

function commandHelp(command: Command): string {
  const lines = [
    `octo ${command.path.join(" ")}${command.usage === undefined ? "" : ` ${command.usage}`}`,
    "",
    command.summary,
  ];
  const options = Object.entries(command.options ?? {});
  if (options.length > 0) {
    lines.push("", "Options:");
    for (const [name, spec] of options) lines.push(optionLine(name, spec));
  }
  if (command.examples !== undefined && command.examples.length > 0) {
    lines.push("", "Examples:");
    for (const example of command.examples) lines.push(`  ${example}`);
  }
  return lines.join("\n");
}

function groupHelp(word: string, commands: readonly Command[]): string {
  const lines = [`octo ${word}`, ""];
  const width = Math.max(...commands.map((command) => command.path.join(" ").length));
  for (const command of commands) lines.push(`  ${command.path.join(" ").padEnd(width)}  ${command.summary}`);
  lines.push("", "Add --help to any command for options and examples.");
  return lines.join("\n");
}

function topHelp(): string {
  const width = Math.max(...COMMANDS.map((command) => command.path.join(" ").length));
  return [
    "octo: a project tracker for one developer and many AI agents",
    "",
    "Agents should start with: octo guide",
    "",
    ...COMMANDS.map((command) => `  ${command.path.join(" ").padEnd(width)}  ${command.summary}`),
    "",
    "Global options:",
    ...Object.entries(GLOBAL_OPTIONS).map(([name, spec]) => optionLine(name, spec)),
    "",
    "Environment: OCTO_AGENT (your name), OCTO_URL (server), OCTO_HOME (data directory).",
  ].join("\n");
}

/** Everything before the first option decides the command, so that `octo issue list -p OCT` resolves properly. */
function leadingWords(argv: readonly string[]): string[] {
  const words: string[] = [];
  for (const word of argv) {
    if (word.startsWith("-")) break;
    words.push(word);
  }
  return words;
}

function pickFormat(argv: readonly string[]): boolean {
  if (argv.includes("--json")) return true;
  if (argv.includes("--text")) return false;
  return process.stdout.isTTY !== true;
}

function report(json: boolean, code: string, message: string, hint: string | null): void {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: { code, message, hint } }));
    return;
  }
  console.error(`error: ${message}`);
  if (hint !== null) console.error(hint);
}

/** Moves leading global flags to the end, so that `octo --json issue list` means the same as `octo issue list --json`. */
export function normalizeArgv(argv: readonly string[]): string[] {
  const moved: string[] = [];
  let index = 0;
  while (index < argv.length) {
    const word = argv[index];
    if (word === "--json" || word === "--text") {
      moved.push(word);
      index += 1;
    } else if (word === "--agent" && argv[index + 1] !== undefined) {
      moved.push(word, argv[index + 1] ?? "");
      index += 2;
    } else {
      break;
    }
  }
  return [...argv.slice(index), ...moved];
}

export async function main(rawArgv: readonly string[]): Promise<number> {
  const argv = normalizeArgv(rawArgv);
  const json = pickFormat(argv);
  const words = leadingWords(argv);
  try {
    const first = words[0];
    if (first === undefined) {
      console.log(topHelp());
      return argv.includes("--help") || argv.includes("-h") ? 0 : EXIT_USAGE;
    }
    const resolved = resolveCommand(words);
    if (resolved === null) {
      const group = commandsUnder(first);
      if (group.length > 0) {
        console.log(groupHelp(first, group));
        return argv.includes("--help") ? 0 : EXIT_USAGE;
      }
      throw new UsageError(`Unknown command "${first}". Run octo --help.`);
    }
    const { command } = resolved;
    const afterCommand = argv.slice(command.path.length);
    const args = parse(afterCommand, { ...GLOBAL_OPTIONS, ...(command.options ?? {}) });
    if (args.flag("help")) {
      console.log(commandHelp(command));
      return 0;
    }
    const actor = args.str("agent") ?? process.env.OCTO_AGENT ?? "agent";
    const mainScript = import.meta.path;
    const client = new OctoClient(serverUrl(), actor, mainScript);
    const code = await command.run({ client, out: makeOutput(json), mainScript }, args);
    return code ?? 0;
  } catch (error) {
    if (error instanceof UsageError) {
      report(json, "usage", error.message, "Add --help for usage.");
      return EXIT_USAGE;
    }
    if (error instanceof RemoteError) {
      report(json, error.body.code, error.body.message, error.body.hint);
      return EXIT_ERROR;
    }
    if (error instanceof OctoError) {
      report(json, error.code, error.message, error.hint);
      return EXIT_ERROR;
    }
    if (error instanceof ConnectionError) {
      report(json, "unreachable", error.message, null);
      return EXIT_UNREACHABLE;
    }
    if (error instanceof ZodError) {
      report(json, "invalid_input", error.message, null);
      return EXIT_ERROR;
    }
    if (error instanceof SyntaxError) {
      report(json, "invalid_input", `Could not read JSON: ${error.message}`, null);
      return EXIT_ERROR;
    }
    report(json, "internal", error instanceof Error ? error.message : String(error), null);
    return EXIT_ERROR;
  }
}

if (import.meta.main) {
  const code = await main(process.argv.slice(2));
  // A foreground `serve` never reaches this line. Everything else is done, whatever handles are still open.
  process.exit(code);
}
