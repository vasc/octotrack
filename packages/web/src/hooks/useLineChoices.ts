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
  not_yet: contracts.lineNotYet.name,
};

const SAID: Readonly<Record<LineChoice, string>> = {
  start: "Started",
  queue: "Up next:",
  done: "Done:",
  drop: "Dropped",
  reject: "Not a line:",
  own: "You own",
  not_yet: "Not yet:",
};

/** The developer's choices on one line, as the line panel offers them. Each waits a few seconds with Undo. */
export function useLineChoices(line: Line) {
  const choices = useChoices();
  return {
    failure: choices.failure,
    choose: (choice: LineChoice) =>
      choices.make(OPS[choice], { ref: line.ref }, `${SAID[choice]} ${line.title}`),
    table: (reason: string, lookAgainAt: string | null) =>
      choices.make(
        contracts.lineTable.name,
        { ref: line.ref, reason, ...(lookAgainAt === null ? {} : { lookAgainAt }) },
        `Tabled ${line.title}`,
      ),
    doneWhen: (accept: boolean) =>
      choices.make(
        contracts.lineDoneWhenAnswer.name,
        { ref: line.ref, accept },
        accept ? `New done when for ${line.title}` : `${line.title} keeps its done when`,
      ),
    tell: (body: string) =>
      choices.make(
        contracts.lineTell.name,
        { line: line.ref, body },
        body === "" ? `Nudged ${line.title}` : `Told ${line.title}: ${body}`,
      ),
    stop: (name: string) => choices.make(contracts.agentStop.name, { name }, `Stopped ${name}`),
    hand: (repos: string[]) =>
      choices.make(
        contracts.lineHand.name,
        { ref: line.ref, ...(repos.length === 0 ? {} : { repos }) },
        `Handed ${line.title} to the agents`,
      ),
    addTask: (title: string) =>
      choices.make(contracts.taskAdd.name, { line: line.ref, title }, `Task on ${line.title}: ${title}`),
    addNote: (body: string) =>
      choices.make(contracts.noteAdd.name, { line: line.ref, body }, `Note on ${line.title}`),
  };
}
