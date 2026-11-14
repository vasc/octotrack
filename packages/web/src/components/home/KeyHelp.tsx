/** Every key, as one list behind ?, in E-States' words. */
export const HOME_KEYS: readonly (readonly [string, string])[] = [
  ["j k", "next and previous thing for you, across lines"],
  ["J K", "next and previous line, Working on then Up next"],
  [
    "1–9",
    "the focused item's numbered choice: an option, a step-in action, a proposal's choice, Done or Can't do it, Accept or Keep current, Done or Not yet",
  ],
  ["w", "answer in my own words"],
  ["l", "later"],
  ["u", "undo the last choice, while it waits"],
  ["o ↵", "open the line of whatever is focused"],
  ["t", "tell the focused line's owner"],
  ["alt ↑ ↓", "move the focused line in the order"],
  ["g p", "choose where I'm at"],
  ["esc", "leave I'm at, close a line"],
  ["g u", "go to an urgent question"],
  ["/", "search"],
  ["r", "record answers given elsewhere, in a batch: D-3 a Went with postgres"],
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
