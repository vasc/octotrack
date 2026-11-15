import type { EntitySummary } from "@octotrack/core/schemas";
import { RefLink } from "../ui/RefLink.tsx";

/** Who Done reaches: whoever holds the freed issue now, or whoever takes it. */
function reaches(freed: EntitySummary): string {
  return freed.assignee === null
    ? `whoever takes ${freed.ref}, and wakes them`
    : `whoever holds ${freed.ref}, now ${freed.assignee}, and wakes it`;
}

/** What a task frees, as E-Issue draws it: each freed issue, openable, and who its Done reaches. */
export function TaskFrees({ freed }: { freed: readonly EntitySummary[] }) {
  if (freed.length === 0) return null;
  return (
    <section className="panel-section" aria-label="What it frees">
      <h2 className="panel-label">What it frees</h2>
      {freed.map((item) => (
        <p key={item.ref} className="panel-prose">
          <RefLink value={item.ref} /> <span>{item.title}</span>
          <br />
          <span className="muted">Done goes to the line's inbox for {reaches(item)}.</span>
        </p>
      ))}
    </section>
  );
}
