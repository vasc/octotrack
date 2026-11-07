import type { PrChecks, PrReview } from "@octotrack/core/schemas";
import type { Tone } from "../../lib/format.ts";
import { humanize } from "../../lib/format.ts";

const CHECKS: Readonly<Record<PrChecks, { glyph: string; tone: Tone }>> = {
  passing: { glyph: "✓", tone: "good" },
  failing: { glyph: "✕", tone: "bad" },
  pending: { glyph: "●", tone: "warn" },
  none: { glyph: "–", tone: "neutral" },
};

const REVIEW: Readonly<Record<PrReview, { glyph: string; tone: Tone }>> = {
  approved: { glyph: "A", tone: "good" },
  changes_requested: { glyph: "C", tone: "bad" },
  requested: { glyph: "R", tone: "warn" },
  none: { glyph: "–", tone: "neutral" },
};

/** Status of a PR at a glance: checks, then review. Labelled, because tone alone is not enough to go on. */
export function PrGlyphs({ checks, review }: { checks: PrChecks; review: PrReview }) {
  const check = CHECKS[checks];
  const reviewed = REVIEW[review];
  const checksLabel = `Checks ${humanize(checks)}`;
  const reviewLabel = `Review ${humanize(review)}`;
  return (
    <span className="pr-glyphs">
      <span className="glyph" data-tone={check.tone} title={checksLabel} role="img" aria-label={checksLabel}>
        {check.glyph}
      </span>
      <span
        className="glyph"
        data-tone={reviewed.tone}
        title={reviewLabel}
        role="img"
        aria-label={reviewLabel}
      >
        {reviewed.glyph}
      </span>
    </span>
  );
}
