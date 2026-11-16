import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import { useMemo, useRef } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLinePlace } from "../../hooks/useLinePlace.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useResolveDecision } from "../../hooks/useResolveDecision.ts";
import { pressNumbered } from "../../lib/focus.ts";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { StartSheetView } from "./StartSheetView.tsx";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Loads what a waiting line holds, so Start shows only the current items before it starts, and answers its held
 * questions in place. While it is open its numbered choices take the number keys.
 */
export function StartSheet({
  line,
  onDoneWhen,
  onStart,
  onCancel,
  armed = true,
}: {
  line: Line;
  /** Whether its number keys act: not while a panel is open over it. */
  armed?: boolean;
  onDoneWhen(ref: string, accept: boolean): void;
  onStart(ref: string): void;
  onCancel(): void;
}) {
  const held = useOpQuery(contracts.heldList, { line: line.ref });
  const questions = useOpQuery(contracts.decisionList, { query: `line:${line.ref} status:open` });
  const place = useLinePlace(line.ref);
  const { resolve } = useResolveDecision();
  const choices = useChoices();
  // A choice made here waits with Undo; until it takes effect the sheet's keys stand down, so one press is one choice.
  const waiting = choices.pending.some(
    (choice) =>
      choice.state === "pending" &&
      choice.ref !== null &&
      (choice.ref === line.ref || (questions.data ?? []).some((question) => question.ref === choice.ref)),
  );
  const current = useMemo(() => (held.data ?? []).filter((item) => item.current), [held.data]);
  // The sheet draws its choices numbered in one run; a number key presses the button drawn with that number.
  const sheet = useRef<HTMLDivElement>(null);
  const keys = useMemo(
    (): HotkeyMap =>
      !armed || waiting
        ? {}
        : Object.fromEntries(
            DIGITS.map((digit) => [
              digit,
              () => {
                if (sheet.current !== null) pressNumbered(sheet.current, digit);
              },
            ]),
          ),
    [armed, waiting],
  );
  // Its number keys answer inside the sheet it opens.
  useHotkeys(keys, { overSheets: true });
  const failure = held.error ?? questions.error;
  // One sheet throughout: while what the line holds loads, or if it failed to, the sheet says so in its place.
  const loading = held.isPending || questions.isPending || failure !== null;
  return (
    <StartSheetView
      sheetRef={sheet}
      {...(loading
        ? {
            status:
              failure === null ? (
                <LoadingState label="Loading what waited for it" />
              ) : (
                <ErrorState
                  title="Could not load what waited for it."
                  error={failure}
                  onRetry={() => {
                    void held.refetch();
                    void questions.refetch();
                  }}
                />
              ),
          }
        : {})}
      line={line}
      held={current}
      questions={questions.data ?? []}
      onDoneWhen={(accept) => onDoneWhen(line.ref, accept)}
      onAnswer={(ref, key, label) =>
        resolve({
          ref,
          option: key,
          note: null,
          summary: `Sending "${label}" to ${place?.title ?? line.title}`,
        })
      }
      onOwn={(ref, words) =>
        resolve({
          ref,
          option: null,
          note: words,
          summary: `Sending "${words}" to ${place?.title ?? line.title}`,
        })
      }
      onStart={() => onStart(line.ref)}
      onCancel={onCancel}
    />
  );
}
