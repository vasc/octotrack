import type { ReactNode } from "react";
import { humanize, type Tone, toneOf } from "../../lib/format.ts";

/**
 * A state in small words, never a pill: grey, ink when it is good news, the warm tone when something is stuck or
 * failing. Colour adds to the words and never replaces them.
 */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="ui-tag" data-tone={tone}>
      {children}
    </span>
  );
}

/** A value whose tone follows from what it means: failing is warm, merged is ink. */
export function StatusBadge({ value }: { value: string }) {
  return <Badge tone={toneOf(value)}>{humanize(value)}</Badge>;
}
