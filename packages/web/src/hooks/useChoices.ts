import { contracts } from "@octotrack/core/contracts";
import { ApiError } from "../api/client.ts";
import { failureText } from "../lib/failure.ts";
import { REFUSED } from "../lib/refused.ts";
import { useOpMutation, useOpQuery } from "./useOp.ts";

/** An Undo the tracker refused because the choice already took effect, said as such. */
function tooLate(error: Error): boolean {
  return error instanceof ApiError && error.code === "conflict";
}

/** The developer's choices that wait a few seconds with Undo, held by the server so closing the page loses nothing. */
export function useChoices() {
  const pending = useOpQuery(contracts.choiceList, {});
  const make = useOpMutation(contracts.choiceMake);
  const undo = useOpMutation(contracts.choiceUndo);
  const now = useOpMutation(contracts.choiceNow);
  return {
    pending: pending.data ?? [],
    /** The choices waiting could not load: the Undo bar says so, with Try again. */
    pendingError: pending.data === undefined ? pending.error : null,
    retryPending: () => void pending.refetch(),
    /** Whether a choice about this item, or carrying this draft's words, is waiting with Undo. */
    waiting: (refOrDraft: string) =>
      (pending.data ?? []).some(
        (choice) => choice.state === "pending" && (choice.ref === refOrDraft || choice.draft === refOrDraft),
      ),
    /** With a draft, the words typed for it stay kept through Undo, and the server deletes them once it takes effect. */
    make: (op: string, input: unknown, summary: string, draft?: string) =>
      make.mutate(
        { op, input, summary, ...(draft === undefined ? {} : { draft }) },
        { onError: (error) => REFUSED.add(summary, failureText(error).text) },
      ),
    undo: (id: number) =>
      undo.mutate(
        { id },
        {
          onError: (error) =>
            tooLate(error)
              ? REFUSED.add("Too late to undo", "it already took effect.", false)
              : REFUSED.add("Undo", failureText(error).text),
        },
      ),
    now: (id: number) =>
      now.mutate({ id }, { onError: (error) => REFUSED.add("Taking it now", failureText(error).text) }),
  };
}
