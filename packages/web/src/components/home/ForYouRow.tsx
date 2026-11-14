import type { ForYou } from "@octotrack/core/schemas";

/** Something waiting on the developer, as one row that opens it. */
export function ForYouRow({ item, onOpen }: { item: ForYou; onOpen(ref: string): void }) {
  if (item.kind === "question") {
    const { decision } = item.card;
    const recommended = decision.options.find((option) => option.key === decision.recommendation);
    return (
      <div className="for-you">
        <span className="for-you-kind">Question · {decision.ref}</span>
        <span className="for-you-title">{decision.title}</span>
        {recommended === undefined ? null : (
          <span className="muted">
            Recommended {recommended.label}
            {decision.recommendationWhy === null ? "" : `: ${decision.recommendationWhy}`}
          </span>
        )}
        <button
          type="button"
          className="btn"
          aria-label={`Open ${decision.ref}`}
          onClick={() => onOpen(decision.ref)}
        >
          Open
        </button>
      </div>
    );
  }
  const { task } = item;
  return (
    <div className="for-you">
      <span className="for-you-kind">
        Task · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
      </span>
      <span className="for-you-title">{task.title}</span>
      <button type="button" className="btn" aria-label={`Open ${task.ref}`} onClick={() => onOpen(task.ref)}>
        Open
      </button>
    </div>
  );
}
