import type { Command } from "./command.ts";
import { decisionCommands } from "./commands/decisions.ts";
import { lineCommands } from "./commands/lines.ts";
import { runnerCommands } from "./commands/runner.ts";
import { taskCommands } from "./commands/tasks.ts";
import { networkCommands } from "./commands/network.ts";
import { observeCommands } from "./commands/observe.ts";
import { installCommands } from "./commands/install.ts";
import { systemCommands } from "./commands/system.ts";
import { workCommands } from "./commands/work.ts";

/**
 * Lines name repos, so the CLI says repo where it used to say project: octo repo create, list and update are the same
 * commands as octo project create, list and update, which keep working.
 */
function asRepoCommands(commands: readonly Command[]): Command[] {
  return commands
    .filter((command) => command.path[0] === "project")
    .map((command) => ({
      ...command,
      path: ["repo", ...command.path.slice(1)],
      summary: command.summary.replace("project", "repo"),
      ...(command.examples === undefined
        ? {}
        : { examples: command.examples.map((example) => example.replace("octo project", "octo repo")) }),
    }));
}

/** The same command under another path, its examples written with that path. */
function aliasOf(command: Command, path: readonly string[]): Command {
  const from = `octo ${command.path.join(" ")}`;
  const to = `octo ${path.join(" ")}`;
  return {
    ...command,
    path,
    ...(command.examples === undefined
      ? {}
      : { examples: command.examples.map((example) => example.replace(from, to)) }),
  };
}

/**
 * D14 names questions, retries, summaries, Tells and done whens in its own words. Each is the older command under that
 * word, and the older one keeps working. `question change` is not here: it is Change answer, a command of its own.
 */
const D14_WORDS: readonly (readonly [readonly string[], readonly string[]])[] = [
  [
    ["question", "later"],
    ["decision", "postpone"],
  ],
  [
    ["line", "retry"],
    ["runner", "retry"],
  ],
  [
    ["summary", "write"],
    ["line", "summarize"],
  ],
  [["tell"], ["line", "tell"]],
  [
    ["done-when", "set"],
    ["line", "done-when"],
  ],
];

function inD14Words(commands: readonly Command[]): Command[] {
  const questions = commands
    .filter((command) => command.path[0] === "decision")
    .map((command) => aliasOf(command, ["question", ...command.path.slice(1)]));
  const renamed = D14_WORDS.flatMap(([alias, original]) => {
    const command = commands.find((candidate) => candidate.path.join(" ") === original.join(" "));
    return command === undefined ? [] : [aliasOf(command, alias)];
  });
  return [...questions, ...renamed];
}

const OWN_COMMANDS: readonly Command[] = [
  ...systemCommands,
  ...installCommands,
  ...observeCommands,
  ...lineCommands,
  ...taskCommands,
  ...runnerCommands,
  ...decisionCommands,
  ...workCommands,
  ...asRepoCommands(workCommands),
  ...networkCommands,
];

export const COMMANDS: readonly Command[] = [...OWN_COMMANDS, ...inD14Words(OWN_COMMANDS)];

/** Longest match wins, so that `watch start` beats `watch`, whose positionals are refs. */
export function resolveCommand(words: readonly string[]): { command: Command; rest: string[] } | null {
  let best: Command | null = null;
  for (const command of COMMANDS) {
    const matches = command.path.every((part, index) => words[index] === part);
    if (matches && (best === null || command.path.length > best.path.length)) best = command;
  }
  return best === null ? null : { command: best, rest: words.slice(best.path.length) };
}

export function commandsUnder(word: string): Command[] {
  return COMMANDS.filter((command) => command.path[0] === word);
}
