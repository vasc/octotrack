import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import type { LineChoice } from "../components/entity/LineActions.tsx";
import { useChoices } from "./useChoices.ts";
import { useOpMutation } from "./useOp.ts";

const OPS: Readonly<Record<LineChoice, string>> = {
  start: contracts.lineStart.name,
  queue: contracts.lineQueue.name,
  done: contracts.lineDone.name,
  drop: contracts.lineDrop.name,
  reject: contracts.lineReject.name,
  own: contracts.lineOwn.name,
  hand: contracts.lineHand.name,
  keep_going: contracts.lineKeepGoing.name,
};

const SAID: Readonly<Record<LineChoice, string>> = {
  start: "Started",
  queue: "Up next:",
  done: "Done:",
  drop: "Dropped",
  reject: "Not a line:",
  own: "You own",
  hand: "Handed to the agents:",
  keep_going: "Keep going:",
};

/** The developer's choices on one line, as the line panel offers them. Each waits a few seconds with Undo. */
export function useLineChoices(line: Line) {
  const choices = useChoices();
  const doneWhen = useOpMutation(contracts.lineDoneWhenAnswer);
  return {
    failure: doneWhen.error ?? choices.failure,
    choose: (choice: LineChoice) =>
      choices.make(OPS[choice], { ref: line.ref }, `${SAID[choice]} ${line.title}`),
    table: (reason: string) =>
      choices.make(contracts.lineTable.name, { ref: line.ref, reason }, `Tabled ${line.title}`),
    doneWhen: (accept: boolean) => doneWhen.mutate({ ref: line.ref, accept }),
  };
}
