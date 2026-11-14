import type { HomeCounts as Counts } from "@octotrack/core/schemas";

const LABELS: readonly (readonly [keyof Counts, string])[] = [
  ["urgent", "urgent"],
  ["toAnswer", "to answer"],
  ["toDo", "to do"],
  ["toAccept", "to accept"],
  ["toStepIn", "to step in"],
];

/** What is waiting on the developer, in a few words, each going to the first such item. Counts of nothing are left out. */
export function HomeCounts({ counts, onPick }: { counts: Counts; onPick(count: keyof Counts): void }) {
  const shown = LABELS.filter(([key]) => counts[key] > 0);
  if (shown.length === 0) return <p className="home-counts muted">Nothing waits on you.</p>;
  return (
    <p className="home-counts" role="status" aria-label="Waiting on you">
      {shown.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className="home-count"
          data-urgent={key === "urgent"}
          onClick={() => onPick(key)}
        >
          {counts[key]} {label}
        </button>
      ))}
    </p>
  );
}
