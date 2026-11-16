import { navigate } from "../../lib/router.ts";
import { Link } from "../ui/Link.tsx";
import { Note } from "../ui/Note.tsx";
import { Stack } from "../ui/Pairs.tsx";

/** What kind of item a ref names, by its prefix, in a word. */
function kindOf(ref: string): string {
  if (/^L-\d+$/.test(ref)) return "line";
  if (/^D-\d+$/.test(ref)) return "question";
  if (/^DR-\d+$/.test(ref)) return "drift";
  if (/^PR-\d+$/.test(ref)) return "pull request";
  return "item";
}

/** The panel's title for a ref nothing answers to: "No line L-312". */
export function notFoundTitle(ref: string): string {
  return `No ${kindOf(ref)} ${ref}`;
}

/**
 * A ref nothing answers to, opened: why it may be gone, since an ended line keeps its ref, and a search of the log for
 * it. Close shuts the panel.
 */
export function RefNotFound({ refName }: { refName: string }) {
  const kind = kindOf(refName);
  const log = `/log?q=${encodeURIComponent(`ref:${refName}`)}`;
  return (
    <Stack>
      <Note>
        {kind === "line"
          ? "No line was ever made with that ref; check it for a typo. Lines that were done, dropped or folded still open at their ref."
          : `No ${kind} was ever made with that ref; check it for a typo.`}
      </Note>
      <Note>
        <Link href={log} onGo={navigate}>
          Search the log for {refName}
        </Link>
      </Note>
    </Stack>
  );
}
