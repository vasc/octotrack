import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import { useOpQuery } from "../../hooks/useOp.ts";
import { LoadingState } from "../ui/states.tsx";
import { StartSheetView } from "./StartSheetView.tsx";

/** Loads what a waiting line holds, so Start shows only the current items before it starts. */
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
  if (held.isPending) return <LoadingState />;
  return (
    <StartSheetView
      line={line}
      held={(held.data ?? []).filter((item) => item.current)}
      onDoneWhen={(accept) => onDoneWhen(line.ref, accept)}
      onStart={() => onStart(line.ref)}
      onCancel={onCancel}
    />
  );
}
