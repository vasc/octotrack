import { Pairs } from "../ui/Pairs.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/** Every key, as one list behind ?. */
export const HOME_KEYS: readonly (readonly [string, string])[] = [
  ["j k", "next, previous item"],
  ["J K", "next, previous line"],
  ["1–9", "the focused item's numbered choice"],
  ["w", "answer in my own words"],
  ["l", "later"],
  ["u", "undo"],
  ["o ↵", "open the line"],
  ["t", "tell the line's owner"],
  ["alt ↑ ↓", "move the line"],
  ["g p", "I'm at"],
  ["esc", "close, leave I'm at"],
  ["g u", "urgent question"],
  ["/", "search"],
  ["r", "record answers"],
];

/** The keys, in a sheet of their own. */
export function KeyHelp({ onClose }: { onClose(): void }) {
  return (
    <Sheet title="Keys" onClose={onClose}>
      <Pairs pairs={HOME_KEYS.map(([keys, what]) => [<kbd key={keys}>{keys}</kbd>, what] as const)} />
    </Sheet>
  );
}
