/** Every key on home, as one list behind ?. */
export const HOME_KEYS: readonly (readonly [string, string])[] = [
  ["j k", "next and previous item"],
  ["J K", "next and previous line, working on then up next"],
  ["1–9", "the focused item's choices, in the order drawn"],
  ["Enter", "send the focused question's answer"],
  ["p", "later: the focused question to the bottom of its line"],
  ["u", "undo the last choice while it waits"],
  ["g u", "the urgent question"],
  ["o", "open the focused item's line"],
  ["t", "table the focused item's line"],
  ["Alt ↑ ↓", "move the focused item's line up or down"],
  ["r", "record answers given elsewhere"],
  ["/", "filter, on the log"],
  ["Esc", "close the panel"],
  ["?", "this list"],
];

export function KeyHelp({ onClose }: { onClose(): void }) {
  return (
    <dialog open className="start-sheet" aria-label="Keys">
      <dl className="key-help">
        {HOME_KEYS.map(([keys, what]) => (
          <div key={keys} className="key-help-row">
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <div className="decision-actions">
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
