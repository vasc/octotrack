import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLinePlace } from "../../hooks/useLinePlace.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useResolveDecision } from "../../hooks/useResolveDecision.ts";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { StartSheetView } from "./StartSheetView.tsx";

/**
 * Loads what a waiting line holds, so Start shows only the current items before it starts, and answers its held
 * questions in place. While it is open its numbered choices take the number keys.
 */
export function StartSheet({
  line,
  onDoneWhen,
  onStart,
  onCancel,
}: {
  line: Line;
  onDoneWhen(ref: string, accept: boolean): void;
  onStart(ref: string): void;
  onCancel(): void;
}) {
  const held = useOpQuery(contracts.heldList, { line: line.ref });
  const questions = useOpQuery(contracts.decisionList, { query: `line:${line.ref} status:open` });
  const place = useLinePlace(line.ref);
  const { resolve } = useResolveDecision();
  const current = useMemo(() => (held.data ?? []).filter((item) => item.current), [held.data]);
  // The sheet draws its choices numbered in one run; the keys follow the same run.
  const keys = useMemo((): HotkeyMap => {
    const actions: (() => void)[] = [];
    if (line.doneWhenProposal !== null) {
      actions.push(
        () => onDoneWhen(line.ref, true),
        () => onDoneWhen(line.ref, false),
      );
    }
    for (const item of current) {
      const question = (questions.data ?? []).find((candidate) => candidate.ref === item.ref);
      if (item.kind !== "question" || question === undefined) continue;
      for (const option of question.options) {
        actions.push(() =>
          resolve({
            ref: question.ref,
            option: option.key,
            note: null,
            summary: `Sending "${option.label}" to ${place?.title ?? line.title}`,
          }),
        );
      }
    }
    return Object.fromEntries(actions.slice(0, 9).map((action, index) => [String(index + 1), action]));
  }, [line, current, questions.data, onDoneWhen, resolve, place]);
  useHotkeys(keys);
  if (held.isPending || questions.isPending) return <LoadingState />;
  const failure = held.error ?? questions.error;
  if (failure !== null) return <ErrorState error={failure} />;
  return (
    <StartSheetView
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
      onStart={() => onStart(line.ref)}
      onCancel={onCancel}
    />
  );
}
