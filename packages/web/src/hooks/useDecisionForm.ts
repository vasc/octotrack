import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { useState } from "react";
import { useChoices } from "./useChoices.ts";
import { useResolveDecision } from "./useResolveDecision.ts";

export interface DecisionForm {
  chosen: string | null;
  /** None of the offered options applies, so the note is the answer. */
  ownAnswer: boolean;
  note: string;
  elsewhere: boolean;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  choose(key: string): void;
  chooseOwn(): void;
  /** Later: to the bottom of its line, or back if it is already there. Waits with Undo like every choice. */
  postpone(): void;
  /** Sends an urgent question back to its place in the line order. */
  notUrgent(): void;
  setNote(note: string): void;
  setElsewhere(value: boolean): void;
  submit(): void;
}

/** The state of deciding one card: pick an option or answer in your own words, optionally say why, confirm. */
export function useDecisionForm(decision: Decision, onPostponed?: (ref: string) => void): DecisionForm {
  const [chosen, setChosen] = useState<string | null>(null);
  const [ownAnswer, setOwnAnswer] = useState(false);
  const [note, setNote] = useState("");
  const [elsewhere, setElsewhere] = useState(false);
  const { resolve, isPending, error } = useResolveDecision();
  const choices = useChoices();
  const trimmed = note.trim();
  const canSubmit = ownAnswer ? trimmed !== "" : chosen !== null || trimmed !== "";

  return {
    chosen,
    ownAnswer,
    note,
    elsewhere,
    canSubmit,
    submitting: isPending,
    error: error?.message ?? null,
    choose: (key) => {
      setOwnAnswer(false);
      setChosen((current) => (current === key ? null : key));
    },
    chooseOwn: () => {
      setChosen(null);
      setOwnAnswer((current) => !current);
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
    setNote,
    setElsewhere,
    submit: () => {
      if (!canSubmit) return;
      const label = decision.options.find((option) => option.key === chosen)?.label;
      resolve({
        ref: decision.ref,
        option: chosen,
        note: trimmed === "" ? null : trimmed,
        summary: `Answered ${decision.ref}: ${label ?? trimmed}`,
        ...(elsewhere ? { channel: "out_of_band" as const } : {}),
      });
    },
  };
}
