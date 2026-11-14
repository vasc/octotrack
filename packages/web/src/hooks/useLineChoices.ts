import { contracts } from "@octotrack/core/contracts";
import type { LineChoice } from "../components/entity/LineActions.tsx";
import { useOpMutation } from "./useOp.ts";

/** The developer's choices on one line, as the line panel offers them. */
export function useLineChoices(ref: string) {
  const start = useOpMutation(contracts.lineStart);
  const queue = useOpMutation(contracts.lineQueue);
  const done = useOpMutation(contracts.lineDone);
  const drop = useOpMutation(contracts.lineDrop);
  const reject = useOpMutation(contracts.lineReject);
  const own = useOpMutation(contracts.lineOwn);
  const hand = useOpMutation(contracts.lineHand);
  const keepGoing = useOpMutation(contracts.lineKeepGoing);
  const table = useOpMutation(contracts.lineTable);
  const doneWhen = useOpMutation(contracts.lineDoneWhenAnswer);
  const byChoice = { start, queue, done, drop, reject, own, hand, keep_going: keepGoing };
  const failure =
    Object.values(byChoice).find((mutation) => mutation.error !== null)?.error ??
    table.error ??
    doneWhen.error;
  return {
    failure,
    choose: (choice: LineChoice) => byChoice[choice].mutate({ ref }),
    table: (reason: string) => table.mutate({ ref, reason }),
    doneWhen: (accept: boolean) => doneWhen.mutate({ ref, accept }),
  };
}
