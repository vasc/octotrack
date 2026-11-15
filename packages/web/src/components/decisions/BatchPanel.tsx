import { contracts } from "@octotrack/core/contracts";
import { type DecisionLine, parseDecisionLines } from "@octotrack/core/decision-lines";
import { useMemo, useState } from "react";
import { useDraft } from "../../hooks/useDraft.ts";
import { useOpMutation } from "../../hooks/useOp.ts";
import { BatchPanelView, type BatchResultLine } from "./BatchPanelView.tsx";

function parseLines(text: string): { parsed: DecisionLine[]; error: string | null } {
  try {
    return { parsed: parseDecisionLines(text), error: null };
  } catch (error) {
    return { parsed: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/** Record answers' lines, kept on the server as they are typed, so they follow the developer between devices. */
const DRAFT = "record-answers";

export function BatchPanel({ autoFocus = false }: { autoFocus?: boolean }) {
  const draft = useDraft(DRAFT);
  const text = draft.value;
  const [results, setResults] = useState<BatchResultLine[] | null>(null);
  const record = useOpMutation(contracts.decisionResolveBatch);
  const { parsed, error } = useMemo(() => parseLines(text), [text]);

  return (
    <BatchPanelView
      text={text}
      parsed={parsed}
      parseError={error ?? record.error?.message ?? null}
      results={results}
      submitting={record.isPending}
      autoFocus={autoFocus}
      onChange={(next) => {
        if (next === "") draft.clear();
        else draft.change(next);
        setResults(null);
      }}
      onSubmit={() =>
        record.mutate(
          { text, channel: "out_of_band" },
          {
            onSuccess: (data) => {
              setResults(data.results.map(({ ref, ok, error: failure }) => ({ ref, ok, error: failure })));
              // Keep the lines that failed, so that they can be fixed and sent again.
              const failed = new Set(data.results.filter((item) => !item.ok).map((item) => item.ref));
              const left = text
                .split("\n")
                .filter((line) => failed.has(line.trim().split(/\s+/)[0]?.toUpperCase() ?? ""))
                .join("\n");
              if (left === "") draft.clear();
              else draft.change(left);
            },
          },
        )
      }
    />
  );
}
