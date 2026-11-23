import type { ForYou } from "@octotrack/core/schemas";

/** What a screen reader says when focus moves to an item: its kind, ref and title, or the line a proposal is about. */
export function focusLabel(item: ForYou, line = ""): string {
  switch (item.kind) {
    case "question":
      return `Question ${item.card.decision.ref}, ${item.card.decision.title}`;
    case "task":
      return `Task ${item.task.ref}, ${item.task.title}`;
    case "done":
      return `Proposed as done: ${line}`;
    case "done_when":
      return `A new done when proposed: ${line}`;
  }
}

/** What an item is known by: a question's or task's ref; a proposal about a line, by its kind and line. */
export function refOf(item: ForYou): string {
  switch (item.kind) {
    case "question":
      return item.card.decision.ref;
    case "task":
      return item.task.ref;
    case "done":
      return `done:${item.line}`;
    case "done_when":
      return `done_when:${item.line}`;
  }
}

/** A working line's Step in, as an item that waits on the developer. */
export function stepInRef(line: string): string {
  return `stepin:${line}`;
}

/** A line itself, with focus on Lines, where j and k move between lines. */
export function lineFocusRef(line: string): string {
  return `line:${line}`;
}

/** The element on the page drawn for an item or a line with focus, found by its ref, as the browser holds it. */
export function focusItem(root: ParentNode, ref: string): HTMLElement | undefined {
  return [...root.querySelectorAll("[data-focus-ref]")]
    .filter((element) => element instanceof HTMLElement)
    .find((element) => element.dataset.focusRef === ref);
}

/**
 * Presses the numbered button within an element, as a click would, unless it is disabled: number keys act on what the
 * page draws, so the drawn number and its action can never disagree (D13).
 */
export function pressNumbered(root: ParentNode, number: string): void {
  const button = root.querySelector(`[data-choice="${number}"]`);
  if (button instanceof HTMLButtonElement && !button.disabled) button.click();
}
