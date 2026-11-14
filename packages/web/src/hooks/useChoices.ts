import { contracts } from "@octotrack/core/contracts";
import { useOpMutation, useOpQuery } from "./useOp.ts";

/** The developer's choices that wait a few seconds with Undo, held by the server so closing the page loses nothing. */
export function useChoices() {
  const pending = useOpQuery(contracts.choiceList, {});
  const make = useOpMutation(contracts.choiceMake);
  const undo = useOpMutation(contracts.choiceUndo);
  const now = useOpMutation(contracts.choiceNow);
  return {
    pending: pending.data ?? [],
    failure: make.error ?? undo.error ?? now.error,
    make: (op: string, input: unknown, summary: string) => make.mutate({ op, input, summary }),
    undo: (id: number) => undo.mutate({ id }),
    now: (id: number) => now.mutate({ id }),
  };
}
