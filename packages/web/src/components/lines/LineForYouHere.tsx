import type { HomeView } from "@octotrack/core/schemas";
import { entriesOf, entryText, forYouPath } from "../../lib/forYou.ts";
import { navigate } from "../../lib/router.ts";
import { NextList } from "../ui/NextList.tsx";

/** What waits on the developer on one line, each opening on For you at that item; nothing when nothing waits. */
export function LineForYouHere({ home, line }: { home: HomeView; line: string }) {
  const entries = entriesOf(home, "all").filter((entry) => entry.line?.ref === line);
  if (entries.length === 0) return null;
  return (
    <NextList
      label="For you here"
      onOpen={(ref) => navigate(forYouPath("all", ref))}
      items={entries.map((entry) => ({
        key: entry.ref,
        href: forYouPath("all", entry.ref),
        ...entryText(entry),
      }))}
    />
  );
}
