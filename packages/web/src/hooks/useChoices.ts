import { contracts } from "@octotrack/core/contracts";
import { ApiError } from "../api/client.ts";
import { failureText } from "../lib/failure.ts";
import { REFUSED } from "../lib/refused.ts";
import { useOpMutation, useOpQuery } from "./useOp.ts";

/** An Undo the tracker refused because the choice already took effect, said as such. */
function tooLate(error: Error): string | null {
  return error instanceof ApiError && error.code === "conflict"
    ? "Too late to undo: it already took effect."
    : null;
}

/** The developer's choices that wait a few seconds with Undo, held by the server so closing the page loses nothing. */
export function useChoices() {
  const pending = useOpQuery(contracts.choiceList, {});
  const make = useOpMutation(contracts.choiceMake);
  const undo = useOpMutation(contracts.choiceUndo);
  const now = useOpMutation(contracts.choiceNow);
  return {
    pending: pending.data ?? [],
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
        { onError: (error) => REFUSED.add("Undo", tooLate(error) ?? failureText(error).text) },
      ),
    now: (id: number) =>
      now.mutate({ id }, { onError: (error) => REFUSED.add("Taking it now", failureText(error).text) }),
  };
}
