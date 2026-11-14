import type { ForYou } from "@octotrack/core/schemas";

function described(items: readonly ForYou[]): string {
  if (items.length === 1) {
    const [item] = items;
    if (item?.kind === "task") return item.task.place === null ? "a task" : `a task at ${item.task.place}`;
    if (item?.kind === "question") return "a question";
    return "a proposal";
  }
  const questions = items.filter((item) => item.kind === "question").length;
  const tasks = items.filter((item) => item.kind === "task").length;
  const others = items.length - questions - tasks;
  return [
    questions === 0 ? null : `${questions} question${questions === 1 ? "" : "s"}`,
    tasks === 0 ? null : `${tasks} task${tasks === 1 ? "" : "s"}`,
    others === 0 ? null : `${others} proposal${others === 1 ? "" : "s"}`,
  ]
    .filter((part) => part !== null)
    .join(" and ");
}

/** The rest of what a line needs from the developer, one link away, saying what it is. */
export function MoreForYou({ items, onShow }: { items: readonly ForYou[]; onShow(): void }) {
  return (
    <button type="button" className="more-link" onClick={onShow}>
      +{items.length} more for you: {described(items)}
    </button>
  );
}
