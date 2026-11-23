import { contracts } from "@octotrack/core/contracts";
import type { Decision, PendingChoice } from "@octotrack/core/schemas";
import { useState } from "react";
import { useChoices } from "./useChoices.ts";
import { useDraft } from "./useDraft.ts";
import { useResolveDecision } from "./useResolveDecision.ts";

/** An answer made here, waiting with Undo before it is sent. */
export interface WaitingAnswer {
  /** The option picked, or null for words. */
  chosen: string | null;
  /** Who it goes to: the agent that asked. */
  to: string;
  dueAt: string;
  undo(): void;
}

export interface DecisionForm {
  /** What is typed as an answer in the developer's own words, or null while that box is closed. */
  ownWords: string | null;
  /** Words sent in the developer's own words are waiting with Undo: they are not sent again. */
  sending: boolean;
  /** Words typed as the answer are not kept on the tracker yet. */
  notSaved: boolean;
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

/** The answer to a question waiting with Undo: an answer only, never Later or Not urgent on the same question. */
export function answerWaiting(pending: readonly PendingChoice[], ref: string): PendingChoice | undefined {
  return pending.find(
    (choice) =>
      choice.state === "pending" && choice.ref === ref && choice.op === contracts.decisionResolve.name,
  );
}

/** Answering one question: an option in one press, or the developer's own words; Later; Not urgent. */
export function useDecisionForm(
  decision: Decision,
  onPostponed?: (ref: string) => void,
  /** Answered, by an option or in words: the page may move on while the answer waits with Undo. */
  onAnswered?: (ref: string) => void,
): DecisionForm {
  const key = `answer:${decision.ref}`;
  // Words typed as an answer are a draft on the server, like a Tell: they follow the developer between devices.
  const draft = useDraft(key);
  // Null until the box is opened or closed by hand: then words already typed open it, and closing keeps them.
  const [writing, setWriting] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { resolve } = useResolveDecision();
  const choices = useChoices();
  // The answer goes to the agent that asked, which the Undo bar names as the card does.
  const to = decision.requestedBy;
  const open = writing ?? draft.value !== "";
  const pending = answerWaiting(choices.pending, decision.ref);
  return {
    ownWords: open ? draft.value : null,
    sending: choices.waiting(key),
    // A send the tracker never took is said in the Undo bar, as every refused choice is.
    notSaved: draft.error !== null,
    waiting:
      pending === undefined
        ? null
        : {
            chosen: pending.draft === null ? picked : null,
            // Who it goes to: the agent that asked.
            to: decision.requestedBy,
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
      onAnswered?.(decision.ref);
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
      onAnswered?.(decision.ref);
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
