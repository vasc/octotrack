import { tellSummary } from "../lib/lines.ts";
import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import type { LineChoice } from "../components/entity/LineActions.tsx";
import { useChoices } from "./useChoices.ts";

const OPS: Readonly<Record<LineChoice, string>> = {
  start: contracts.lineStart.name,
  queue: contracts.lineQueue.name,
  done: contracts.lineDone.name,
  drop: contracts.lineDrop.name,
  reject: contracts.lineReject.name,
  own: contracts.lineOwn.name,
};

/** What each choice is doing while it waits, as the Undo bar says it. */
const SAID: Readonly<Record<LineChoice, (title: string) => string>> = {
  start: (title) => `Starting ${title}`,
  queue: (title) => `Moving ${title} to up next`,
  done: (title) => `Closing ${title} as done`,
  drop: (title) => `Dropping ${title}`,
  reject: (title) => `Turning down ${title}: not a line`,
  own: (title) => `Taking ${title} as yours`,
};

/** The developer's choices on one line, as the line panel offers them. Each waits a few seconds with Undo. */
export function useLineChoices(line: Line) {
  const choices = useChoices();
  return {
    failure: choices.failure,
    choose: (choice: LineChoice) => choices.make(OPS[choice], { ref: line.ref }, SAID[choice](line.title)),
    table: (reason: string, lookAgainAt: string | null) =>
      choices.make(
        contracts.lineTable.name,
        { ref: line.ref, reason, ...(lookAgainAt === null ? {} : { lookAgainAt }) },
        `Tabling ${line.title}`,
      ),
    doneWhen: (accept: boolean) =>
      choices.make(
        contracts.lineDoneWhenAnswer.name,
        { ref: line.ref, accept },
        accept ? `Accepting the new done when for ${line.title}` : `Keeping ${line.title}'s done when`,
      ),
    tell: (body: string) =>
      choices.make(
        contracts.lineTell.name,
        { line: line.ref, body },
        tellSummary(`${line.title}'s owner`, body),
        `tell:${line.ref}`,
      ),
    stop: (name: string) => choices.make(contracts.agentStop.name, { name }, `Stopping ${name}`),
    hand: (repos: string[]) =>
      choices.make(
        contracts.lineHand.name,
        { ref: line.ref, ...(repos.length === 0 ? {} : { repos }) },
        `Handing ${line.title} to the agents`,
      ),
    addTask: (title: string) =>
      choices.make(
        contracts.taskAdd.name,
        { line: line.ref, title },
        `Adding a task to ${line.title}: ${title}`,
        `own:${line.ref}`,
      ),
    addNote: (body: string) =>
      choices.make(
        contracts.noteAdd.name,
        { line: line.ref, body },
        `Adding a note to ${line.title}`,
        `own:${line.ref}`,
      ),
  };
}
