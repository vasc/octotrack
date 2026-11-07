import { contracts } from "@octotrack/core/contracts";
import type { Channel } from "@octotrack/core/schemas";
import { useOpMutation } from "./useOp.ts";

export interface ResolveInput {
  ref: string;
  option: string | null;
  note: string | null;
  channel?: Channel;
}

/**
 * Deliberately not optimistic. On loopback the round trip is a few milliseconds, so there is nothing to hide, and
 * removing the card early would unmount the very form that has to show the error if the server refuses.
 */
export function useResolveDecision() {
  const mutation = useOpMutation(contracts.decisionResolve);
  return {
    isPending: mutation.isPending,
    error: mutation.error,
    resolve(input: ResolveInput): void {
      mutation.mutate({
        ref: input.ref,
        ...(input.option === null ? {} : { option: input.option }),
        ...(input.note === null ? {} : { note: input.note }),
        ...(input.channel === undefined ? {} : { channel: input.channel }),
      });
    },
  };
}
