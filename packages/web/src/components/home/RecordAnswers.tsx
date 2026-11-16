import { BatchPanel } from "../decisions/BatchPanel.tsx";

/** Record answers, behind r: answers given elsewhere, one per row, each placed on its question. */
export function RecordAnswers({ onClose }: { onClose(): void }) {
  return <BatchPanel autoFocus onClose={onClose} />;
}
