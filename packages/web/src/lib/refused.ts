/** A choice the tracker never took: what it was, and why, in the page's words. */
export interface Refusal {
  id: number;
  summary: string;
  reason: string;
}

/**
 * Choices whose request failed before the tracker held them, kept on this page until dismissed. They live outside
 * React, since any part of the page can make a choice, and the Undo bar shows them all.
 */
export function refusals() {
  let items: readonly Refusal[] = [];
  let next = 1;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    list: (): readonly Refusal[] => items,
    add(summary: string, reason: string): number {
      const id = next;
      next += 1;
      items = [...items, { id, summary, reason }];
      changed();
      return id;
    },
    dismiss(id: number): void {
      items = items.filter((item) => item.id !== id);
      changed();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The page's one list of refusals. */
export const REFUSED = refusals();
