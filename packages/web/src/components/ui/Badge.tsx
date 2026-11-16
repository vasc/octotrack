import type { ReactNode } from "react";
import { glyphOf, humanize, type Tone, toneOf } from "../../lib/format.ts";

/**
 * A state in small words with its glyph, never a pill and never colour alone: ✓ good news, ✗ something broke, ▲ stuck
 * or waiting, ◐ moving, ● needs you, – ended, ○ not started.
 */
export function Badge({
  tone = "neutral",
  glyph,
  children,
}: {
  tone?: Tone;
  glyph?: string;
  children: ReactNode;
}) {
  if (children === "" || children === null || children === undefined) return null;
  return (
    <span className="ui-tag" data-tone={tone}>
      {glyph === undefined ? null : <span aria-hidden="true">{glyph} </span>}
      {children}
    </span>
  );
}

/** A value whose tone and glyph follow from what it means: failing is ✗, merged is ✓. */
export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge tone={toneOf(value)} glyph={glyphOf(value)}>
      {humanize(value)}
    </Badge>
  );
}

/** A state's glyph alone, in its tone, before words that say the same: "●" before "running, on its line". */
export function Glyph({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  return (
    <span className="ui-glyph" data-tone={tone} aria-hidden="true">
      {children}
    </span>
  );
}
