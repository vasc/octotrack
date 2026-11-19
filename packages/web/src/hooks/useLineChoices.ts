import { tellSummary } from "../lib/lines.ts";
import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import { doneWhenSaid, LINE_SAID, type LineChoice } from "../lib/said.ts";
import { useChoices } from "./useChoices.ts";

const OPS: Readonly<Record<LineChoice, string>> = {
  start: contracts.lineStart.name,
  queue: contracts.lineQueue.name,
  done: contracts.lineDone.name,
  drop: contracts.lineDrop.name,
  reject: contracts.lineReject.name,
  own: contracts.lineOwn.name,
};

/** The developer's choices on one line, as the line panel offers them. Each waits a few seconds with Undo. */
export function useLineChoices(line: Line) {
  const choices = useChoices();
  return {
    choose: (choice: LineChoice) =>
      choices.make(OPS[choice], { ref: line.ref }, LINE_SAID[choice](line.title)),
    table: (reason: string | null, lookAgainAt: string | null) =>
      choices.make(
        contracts.lineTable.name,
        {
          ref: line.ref,
          ...(reason === null ? {} : { reason }),
          ...(lookAgainAt === null ? {} : { lookAgainAt }),
        },
        LINE_SAID.table(line.title),
      ),
    doneWhen: (accept: boolean) =>
      choices.make(
        contracts.lineDoneWhenAnswer.name,
        { ref: line.ref, accept },
        doneWhenSaid(line.title, accept),
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
