import { BatchPanel } from "../decisions/BatchPanel.tsx";

/** Record answers, behind r: answers given elsewhere, one per line, each placed on its question. */
export function RecordAnswers({ onClose }: { onClose(): void }) {
  return (
    <section className="home-section" aria-label="Record answers">
      <BatchPanel />
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </section>
  );
}
