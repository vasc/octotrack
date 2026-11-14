import type { HeldItem, Line } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";

/**
 * Starting a line that waited: what it holds that is still current (questions and tasks asked or re-confirmed in the
 * last 7 days), any done when an agent proposed while it waited, then Start now.
 */
export function StartSheetView({
  line,
  held,
  onDoneWhen,
  onStart,
  onCancel,
}: {
  line: Line;
  held: readonly HeldItem[];
  onDoneWhen(accept: boolean): void;
  onStart(): void;
  onCancel(): void;
}) {
  return (
    <dialog open className="start-sheet" aria-label={`Start ${line.title}`}>
      {held.length === 0 ? (
        <p className="muted">Nothing held: it starts clean.</p>
      ) : (
        <>
          <p className="muted">It holds, and these reach you once it starts:</p>
          <ul className="start-sheet-list">
            {held.map((item) => (
              <li key={item.ref}>
                <span className="for-you-kind">
                  {item.kind === "question" ? "Question" : "Task"} · {item.ref}
                </span>{" "}
                {item.title}
              </li>
            ))}
          </ul>
        </>
      )}
      {line.doneWhenProposal === null ? null : (
        <div className="proposal">
          <p>
            <strong>Done when changed</strong> <Markdown text={line.doneWhenProposal} inline />
          </p>
          <div className="decision-actions">
            <button type="button" className="btn" onClick={() => onDoneWhen(true)}>
              Accept
            </button>
            <button type="button" className="btn" onClick={() => onDoneWhen(false)}>
              Keep current
            </button>
          </div>
        </div>
      )}
      <div className="decision-actions">
        <button type="button" className="btn" data-primary="true" onClick={onStart}>
          Start now
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
