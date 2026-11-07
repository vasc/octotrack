import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { useState } from "react";
import { useOpMutation } from "./useOp.ts";
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
  /** Pushes it to the bottom of the queue, or brings it back if it is already there. */
  postpone(): void;
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
  const postponement = useOpMutation(contracts.decisionPostpone);
  const trimmed = note.trim();
  const canSubmit = ownAnswer ? trimmed !== "" : chosen !== null || trimmed !== "";

  return {
    chosen,
    ownAnswer,
    note,
    elsewhere,
    canSubmit,
    submitting: isPending,
    error: (error ?? postponement.error)?.message ?? null,
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
      postponement.mutate(
        { ref: decision.ref, ...(undo ? { undo } : {}) },
        { onSuccess: () => (undo ? undefined : onPostponed?.(decision.ref)) },
      );
    },
    setNote,
    setElsewhere,
    submit: () => {
      if (!canSubmit) return;
      resolve({
        ref: decision.ref,
        option: chosen,
        note: trimmed === "" ? null : trimmed,
        ...(elsewhere ? { channel: "out_of_band" as const } : {}),
      });
    },
  };
}
