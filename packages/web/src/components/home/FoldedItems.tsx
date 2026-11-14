import type { ForYou } from "@octotrack/core/schemas";

/** What a folded line holds for the developer, in a few words: "1 question · 1 task at the Mac". */
export function foldedText(items: readonly ForYou[]): string {
  const questions = items.filter((item) => item.kind === "question").length;
  const proposals = items.filter((item) => item.kind === "done" || item.kind === "done_when").length;
  const places = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "task") continue;
    const place = item.task.place ?? "";
    places.set(place, (places.get(place) ?? 0) + 1);
  }
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return [
    questions === 0 ? null : plural(questions, "question"),
    ...[...places].map(([place, count]) => `${plural(count, "task")}${place === "" ? "" : ` at ${place}`}`),
    proposals === 0 ? null : plural(proposals, "proposal"),
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** The rest of a line's items while I'm at a place, folded to one link that opens the first. */
export function FoldedItems({ items, onOpen }: { items: readonly ForYou[]; onOpen(): void }) {
  if (items.length === 0) return null;
  return (
    <button type="button" className="more-link" onClick={onOpen}>
      {foldedText(items)}, folded
    </button>
  );
}
