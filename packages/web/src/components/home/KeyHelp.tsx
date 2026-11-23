import { Columns } from "../ui/Columns.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";
import { Section } from "../ui/Section.tsx";
import { Sheet } from "../ui/Sheet.tsx";
import { Keys } from "../ui/Keys.tsx";

/** The keys on For you: moving through what waits, and answering the one open. */
export const FOR_YOU_KEYS: readonly (readonly [string, string])[] = [
  ["j k", "next, previous item"],
  ["1–9", "pick a numbered choice"],
  ["w", "answer in your own words"],
  ["l", "later: to the bottom"],
  ["o Return", "peek at its line"],
  ["t", "tell its line's owner"],
  ["g u", "the urgent ones"],
  ["r", "record answers given elsewhere"],
];

/** The keys on Lines, which act on the line with focus. */
export const LINES_KEYS: readonly (readonly [string, string])[] = [
  ["j k", "next, previous line"],
  ["o Return", "open its page"],
  ["t", "tell its owner"],
  ["Option Up Down", "move it in your order"],
];

/** The keys that act on every page. */
export const ANYWHERE_KEYS: readonly (readonly [string, string])[] = [
  ["u", "undo the last choice"],
  ["/", "search the log"],
  ["?", "these keys"],
  ["esc", "close, go back"],
];

/** Every key, as the Keys sheet lists them, page by page. */
export const ALL_KEYS: readonly (readonly [string, string])[] = [
  ...FOR_YOU_KEYS,
  ...LINES_KEYS,
  ...ANYWHERE_KEYS,
];

/**
 * The keys, in a sheet of their own that only shows, so it closes with Close (triage/T-Keys): For you's in one column,
 * Lines' and everywhere's in the other, each key a cap.
 */
export function KeyHelp({ onClose }: { onClose(): void }) {
  const pairs = (keys: readonly (readonly [string, string])[]) =>
    keys.map(([key, what]) => [<Keys key={key} keys={key} />, what] as const);
  return (
    <Sheet title="Keys" onClose={onClose} closeLabel="Close" wide>
      <Columns>
        <Section title="On For you">
          <Pairs pairs={pairs(FOR_YOU_KEYS)} />
        </Section>
        <Stack>
          <Section title="On Lines">
            <Pairs pairs={pairs(LINES_KEYS)} />
          </Section>
          <Section title="Anywhere">
            <Pairs pairs={pairs(ANYWHERE_KEYS)} />
          </Section>
        </Stack>
      </Columns>
    </Sheet>
  );
}
