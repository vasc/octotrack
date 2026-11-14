import type { AtView } from "@octotrack/core/schemas";

/** Hours left until I'm at ends by itself, in whole hours, at least one. */
function hoursLeft(until: string, now: number): number {
  return Math.max(1, Math.round((Date.parse(until) - now) / 3_600_000));
}

/**
 * I'm at a place, as E-States draws it: the list stays in its order, every task for the place opens on its line, and
 * everything else folds. It ends by itself, or with Leave.
 */
export function AtSection({ at, now, onLeave }: { at: AtView; now: number; onLeave(): void }) {
  const hours = hoursLeft(at.until, now);
  return (
    <section className="at-head" aria-label={`At ${at.place}`}>
      <div>
        <h2 className="calm-title">At {at.place}.</h2>
        <p className="muted">
          Everything else is folded. Ends by itself in {hours} hour{hours === 1 ? "" : "s"}.
        </p>
      </div>
      <button type="button" className="btn" onClick={onLeave}>
        Leave
      </button>
    </section>
  );
}
