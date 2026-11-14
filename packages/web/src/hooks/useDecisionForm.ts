import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { useState } from "react";
import { useChoices } from "./useChoices.ts";
import { useResolveDecision } from "./useResolveDecision.ts";

export interface DecisionForm {
  /** What is typed as an answer in the developer's own words, or null while that box is closed. */
  ownWords: string | null;
  error: string | null;
  /** Picks an option, which answers: it waits a few seconds with Undo, like every choice. */
  answer(key: string): void;
  openOwn(): void;
  closeOwn(): void;
  setOwn(text: string): void;
  /** Sends what was typed as the answer. */
  sendOwn(): void;
  /** Later: to the bottom of its line, or back if it is already there. */
  postpone(): void;
  /** Sends an urgent question back to its place in the line order. */
  notUrgent(): void;
}

/** Answering one question: an option in one press, or the developer's own words; Later; Not urgent. */
export function useDecisionForm(decision: Decision, onPostponed?: (ref: string) => void): DecisionForm {
  const [ownWords, setOwnWords] = useState<string | null>(null);
  const { resolve, error } = useResolveDecision();
  const choices = useChoices();
  return {
    ownWords,
    error: error?.message ?? null,
    answer: (key) => {
      const label = decision.options.find((option) => option.key === key)?.label ?? key;
      resolve({
        ref: decision.ref,
        option: key,
        note: null,
        summary: `Sending "${label}" to ${decision.ref}`,
      });
    },
    openOwn: () => setOwnWords(""),
    closeOwn: () => setOwnWords(null),
    setOwn: setOwnWords,
    sendOwn: () => {
      const words = ownWords?.trim() ?? "";
      if (words === "") return;
      resolve({
        ref: decision.ref,
        option: null,
        note: words,
        summary: `Sending your words to ${decision.ref}`,
      });
      setOwnWords(null);
    },
    postpone: () => {
      const undo = decision.postponedAt !== null;
      choices.make(
        contracts.decisionPostpone.name,
        { ref: decision.ref, ...(undo ? { undo } : {}) },
        undo ? `Brought back ${decision.ref}` : `${decision.ref} later`,
      );
      if (!undo) onPostponed?.(decision.ref);
    },
    notUrgent: () =>
      choices.make(contracts.decisionNotUrgent.name, { ref: decision.ref }, `${decision.ref} is not urgent`),
  };
}
