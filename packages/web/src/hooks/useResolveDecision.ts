import { contracts } from "@octotrack/core/contracts";
import type { Channel } from "@octotrack/core/schemas";
import { useChoices } from "./useChoices.ts";

export interface ResolveInput {
  ref: string;
  option: string | null;
  note: string | null;
  channel?: Channel;
  /** What the answer is, in words, for the Undo bar. */
  summary: string;
}

/**
 * An answer is a choice like any other: it waits a few seconds with Undo, held by the server, then takes effect. A
 * refusal (someone else answered first, say) comes back as a failed choice in the Undo bar, with why.
 */
export function useResolveDecision() {
  const choices = useChoices();
  return {
    isPending: false,
    error: choices.failure,
    resolve(input: ResolveInput): void {
      choices.make(
        contracts.decisionResolve.name,
        {
          ref: input.ref,
          ...(input.option === null ? {} : { option: input.option }),
          ...(input.note === null ? {} : { note: input.note }),
          ...(input.channel === undefined ? {} : { channel: input.channel }),
        },
        input.summary,
      );
    },
  };
}
