import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { useState } from "react";
import { useChoices } from "./useChoices.ts";
import { useDraft } from "./useDraft.ts";
import { useLinePlace } from "./useLinePlace.ts";
import { useResolveDecision } from "./useResolveDecision.ts";

/** An answer made here, waiting with Undo before it is sent. */
export interface WaitingAnswer {
  /** The option picked, or null for words. */
  chosen: string | null;
  /** Where it goes: the line's title, or the question's ref. */
  to: string;
  dueAt: string;
  undo(): void;
}

export interface DecisionForm {
  /** What is typed as an answer in the developer's own words, or null while that box is closed. */
  ownWords: string | null;
  /** Words sent in the developer's own words are waiting with Undo: they are not sent again. */
  sending: boolean;
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
  /** An answer waiting with Undo, shown in the card itself. */
  waiting: WaitingAnswer | null;
}

/** Answering one question: an option in one press, or the developer's own words; Later; Not urgent. */
export function useDecisionForm(decision: Decision, onPostponed?: (ref: string) => void): DecisionForm {
  const key = `answer:${decision.ref}`;
  // Words typed as an answer are a draft on the server, like a Tell: they follow the developer between devices.
  const draft = useDraft(key);
  // Null until the box is opened or closed by hand: then words already typed open it, and closing keeps them.
  const [writing, setWriting] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { resolve, error } = useResolveDecision();
  const choices = useChoices();
  const line = useLinePlace(decision.line);
  const to = line?.title ?? decision.ref;
  const open = writing ?? draft.value !== "";
  const pending = choices.pending.find((choice) => choice.state === "pending" && choice.ref === decision.ref);
  return {
    ownWords: open ? draft.value : null,
    sending: choices.waiting(key),
    error: error?.message ?? (draft.error === null ? null : `Not saved: ${draft.error}`),
    waiting:
      pending === undefined
        ? null
        : {
            chosen: pending.draft === null ? picked : null,
            to,
            dueAt: pending.dueAt,
            undo: () => choices.undo(pending.id),
          },
    answer: (key) => {
      setPicked(key);
      const label = decision.options.find((option) => option.key === key)?.label ?? key;
      resolve({
        ref: decision.ref,
        option: key,
        note: null,
        summary: `Sending "${label}" to ${to}`,
      });
    },
    openOwn: () => setWriting(true),
    closeOwn: () => setWriting(false),
    setOwn: draft.change,
    sendOwn: () => {
      const words = draft.value.trim();
      if (words === "" || choices.waiting(key)) return;
      setWriting(false);
      void draft.flush().then(() =>
        resolve({
          ref: decision.ref,
          option: null,
          note: words,
          summary: `Sending your words to ${to}`,
          draft: key,
        }),
      );
    },
    postpone: () => {
      const undo = decision.postponedAt !== null;
      choices.make(
        contracts.decisionPostpone.name,
        { ref: decision.ref, ...(undo ? { undo } : {}) },
        undo ? `Bringing back ${decision.ref}` : `Putting ${decision.ref} off until later`,
      );
      if (!undo) onPostponed?.(decision.ref);
    },
    notUrgent: () =>
      choices.make(
        contracts.decisionNotUrgent.name,
        { ref: decision.ref },
        `Returning ${decision.ref} to its line, not urgent`,
      ),
  };
}
