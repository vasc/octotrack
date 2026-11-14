import type { Command } from "./command.ts";
import { decisionCommands } from "./commands/decisions.ts";
import { lineCommands } from "./commands/lines.ts";
import { runnerCommands } from "./commands/runner.ts";
import { taskCommands } from "./commands/tasks.ts";
import { networkCommands } from "./commands/network.ts";
import { observeCommands } from "./commands/observe.ts";
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

export const COMMANDS: readonly Command[] = [
  ...systemCommands,
  ...observeCommands,
  ...lineCommands,
  ...taskCommands,
  ...runnerCommands,
  ...decisionCommands,
  ...workCommands,
  ...asRepoCommands(workCommands),
  ...networkCommands,
];

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
