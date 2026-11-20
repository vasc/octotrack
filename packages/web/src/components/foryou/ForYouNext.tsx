import { afterText, type Entry, entryText, type Filter, forYouPath } from "../../lib/forYou.ts";
import { NextList } from "../ui/NextList.tsx";

/** How many of the entries after the open one are named beside it. */
const SHOWN = 2;

/** What comes after the open entry: the next two, then what the other views hold once this one is done. */
export function ForYouNext({
  entries,
  index,
  filter,
  counts,
  onOpen,
}: {
  entries: readonly Entry[];
  /** Where the open entry is in the list. */
  index: number;
  filter: Filter;
  counts: Readonly<Record<Filter, number>>;
  onOpen(ref: string): void;
}) {
  const next = entries.slice(index + 1, index + 1 + SHOWN);
  const after = afterText(counts, filter);
  if (next.length === 0 && after === null) return null;
  return (
    <NextList
      label="Next"
      onOpen={onOpen}
      items={next.map((entry) => ({
        key: entry.ref,
        href: forYouPath(filter, entry.ref),
        ...entryText(entry),
      }))}
      {...(after === null ? {} : { after: `Then ${after}.` })}
    />
  );
}
