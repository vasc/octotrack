import { contracts } from "@octotrack/core/contracts";
import type { DriftMode } from "../components/drift/DriftAnswer.tsx";
import { useChoices } from "./useChoices.ts";

/**
 * Clearing something out of date, as a choice that waits with Undo like every other: whether one is on its way, and
 * the answer itself, said in the Undo bar as what it does.
 */
export function useDriftAck() {
  const choices = useChoices();
  return {
    busy: (ref: string) => choices.waiting(ref),
    ack: (ref: string, mode: DriftMode, note: string) =>
      choices.make(
        contracts.driftAck.name,
        { refs: [ref], mode, note },
        mode === "updated"
          ? `Marking ${ref} updated: ${note}`
          : `Marking ${ref} as needing no update: ${note}`,
      ),
  };
}
