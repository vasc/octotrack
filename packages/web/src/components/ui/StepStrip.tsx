/**
 * How far along a plan is, as a strip of short segments, one per step (triage/T-Lines): the steps before the current
 * one filled in the accent, the current one in a lighter tint, the rest grey. Its words, said beside it, name the step.
 */
export function StepStrip({ at, of }: { at: number; of: number }) {
  return (
    <span className="ui-step-strip" aria-hidden="true">
      {Array.from({ length: of }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the segments are the steps by position, and never reorder
          key={index}
          className="ui-step-segment"
          data-state={index + 1 < at ? "done" : index + 1 === at ? "now" : undefined}
        />
      ))}
    </span>
  );
}
