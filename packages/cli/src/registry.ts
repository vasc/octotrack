import type { Command } from "./command.ts";
import { decisionCommands } from "./commands/decisions.ts";
import { networkCommands } from "./commands/network.ts";
import { observeCommands } from "./commands/observe.ts";
import { systemCommands } from "./commands/system.ts";
import { workCommands } from "./commands/work.ts";

export const COMMANDS: readonly Command[] = [
  ...systemCommands,
  ...observeCommands,
  ...decisionCommands,
  ...workCommands,
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
