import { BatchPanel } from "../decisions/BatchPanel.tsx";

/** Record answers, behind r: answers given elsewhere, one per line, each placed on its question. */
export function RecordAnswers({ onClose }: { onClose(): void }) {
  return (
    // Esc closes it even from inside its box, where the page's keys stand aside for typing; what was typed is kept.
    <section
      className="home-section"
      aria-label="Record answers"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <BatchPanel autoFocus />
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </section>
  );
}
