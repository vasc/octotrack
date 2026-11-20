import type { ReactNode } from "react";
import type { Entry } from "../../lib/forYou.ts";
import { Card } from "../ui/Card.tsx";
import { Facts } from "../ui/Facts.tsx";
import { PeekLink } from "../ui/PeekLink.tsx";
import { Progress } from "../ui/Progress.tsx";

/**
 * The one entry open on For you: where you are in the view, then on the card the line it is on, which peeks in place,
 * and the entry itself.
 */
export function ForYouCard({
  entry,
  view,
  at,
  of,
  urgent,
  step,
  peeking,
  onPeek,
  children,
}: {
  entry: Entry;
  /** The view's name, such as To answer. */
  view: string;
  at: number;
  of: number;
  urgent: boolean;
  /** Where the line stands: "step 2 of 4, Print the base". */
  step: string | null;
  /** The line's peek is open now. */
  peeking: boolean;
  onPeek(line: string): void;
  children: ReactNode;
}) {
  const line = entry.line;
  return (
    <Card label="Open now" top={<Progress name={view} at={at} of={of} urgent={urgent} />}>
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
