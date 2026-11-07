import type { ReactNode } from "react";
import { humanize, type Tone, toneOf } from "../../lib/format.ts";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}

/** A value whose tone follows from what it means: failing is red, merged is green. */
export function StatusBadge({ value }: { value: string }) {
  return <Badge tone={toneOf(value)}>{humanize(value)}</Badge>;
}
