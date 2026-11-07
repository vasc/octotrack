import type { Decision } from "@octotrack/core/schemas";
import { useState } from "react";
import { useResolveDecision } from "./useResolveDecision.ts";

export interface DecisionForm {
  chosen: string | null;
  note: string;
  elsewhere: boolean;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  choose(key: string): void;
  setNote(note: string): void;
  setElsewhere(value: boolean): void;
  submit(): void;
}

/** The state of deciding one card: pick an option, optionally say why, confirm. */
export function useDecisionForm(decision: Decision): DecisionForm {
  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [elsewhere, setElsewhere] = useState(false);
  const { resolve, isPending, error } = useResolveDecision();
  const trimmed = note.trim();
  const canSubmit = chosen !== null || trimmed !== "";

  return {
    chosen,
    note,
    elsewhere,
    canSubmit,
    submitting: isPending,
    error: error?.message ?? null,
    choose: (key) => setChosen((current) => (current === key ? null : key)),
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
