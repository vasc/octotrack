import { Pairs } from "../ui/Pairs.tsx";
import { Section } from "../ui/Section.tsx";
import { Sheet } from "../ui/Sheet.tsx";

/** The keys that move around, as the Keys sheet lists them. */
export const MOVING_KEYS: readonly (readonly [string, string])[] = [
  ["j k", "next, previous item"],
  ["J K", "next, previous line"],
  ["o ↵", "open the line"],
  ["g u", "urgent question"],
  ["/", "search the log"],
  ["esc", "close, go back"],
];

/** The keys that act on what has focus. */
export const ACTING_KEYS: readonly (readonly [string, string])[] = [
  ["1–9", "pick a numbered choice"],
  ["w", "answer in your words"],
  ["l", "later"],
  ["u", "undo"],
  ["t", "tell the owner"],
  ["⌥ ↑ ↓", "move the line"],
  ["g p", "I'm at"],
  ["r", "record answers"],
];

/** The keys that act only on Lines, where the items and their choices are. */
const LINES_ONLY: ReadonlySet<string> = new Set([
  "j k",
  "J K",
  "o ↵",
  "g u",
  "1–9",
  "w",
  "l",
  "t",
  "⌥ ↑ ↓",
  "r",
]);

/** Every key, as one list behind ?, in two groups: moving around, and acting on what has focus. */
export const HOME_KEYS: readonly (readonly [string, string])[] = [...MOVING_KEYS, ...ACTING_KEYS];

/**
 * The keys, in a sheet of their own that only shows, so it closes with Close. Opened from the Log or Agents, the keys
 * that act only on Lines say so.
 */
export function KeyHelp({ onClose, onLines = true }: { onClose(): void; onLines?: boolean }) {
  const pairs = (keys: readonly (readonly [string, string])[]) =>
    keys.map(
      ([key, what]) =>
        [<kbd key={key}>{key}</kbd>, onLines || !LINES_ONLY.has(key) ? what : `${what} on Lines`] as const,
    );
  return (
    <Sheet title="Keys" onClose={onClose} closeLabel="Close">
      <Section title="Moving">
        <Pairs pairs={pairs(MOVING_KEYS)} />
      </Section>
      <Section title="Acting">
        <Pairs pairs={pairs(ACTING_KEYS)} />
      </Section>
    </Sheet>
  );
}
