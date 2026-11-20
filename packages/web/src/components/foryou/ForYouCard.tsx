import { type ReactNode, useEffect, useRef } from "react";
import type { Entry } from "../../lib/forYou.ts";
import { Card } from "../ui/Card.tsx";
import { Facts } from "../ui/Facts.tsx";
import { PeekLink } from "../ui/PeekLink.tsx";

/**
 * The one entry open on For you, in place in its list: the line it is on, which peeks in place, and where that line
 * stands; then the entry itself. Opened, it comes into view, as the browser's scroll is outside React.
 */
export function ForYouCard({
  entry,
  step,
  peeking,
  onPeek,
  children,
}: {
  entry: Entry;
  /** Where the line stands: "step 2 of 4, Print the base". */
  step: string | null;
  /** The line's peek is open now. */
  peeking: boolean;
  onPeek(line: string): void;
  children: ReactNode;
}) {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = card.current;
    if (element !== null && typeof element.scrollIntoView === "function")
      element.scrollIntoView({ block: "nearest" });
  }, []);
  const line = entry.line;
  return (
    <Card label="Open now" ref={card}>
      {line === null || entry.item.kind === "proposal" ? null : (
        <Facts>
          <PeekLink href={`/lines/${line.ref}`} open={peeking} onPeek={() => onPeek(line.ref)}>
            {line.title}
          </PeekLink>
          {step}
        </Facts>
      )}
      {children}
    </Card>
  );
}
