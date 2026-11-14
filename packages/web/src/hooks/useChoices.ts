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
    /** With a draft, the words typed for it stay kept through Undo, and the server deletes them once it takes effect. */
    make: (op: string, input: unknown, summary: string, draft?: string) =>
      make.mutate({ op, input, summary, ...(draft === undefined ? {} : { draft }) }),
    undo: (id: number) => undo.mutate({ id }),
    now: (id: number) => now.mutate({ id }),
  };
}
