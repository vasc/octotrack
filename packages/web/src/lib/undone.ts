/**
 * The choices undone on this page, by id. The tracker lists only choices still waiting, so once one goes from the list
 * this says whether it was undone or took effect; any part of the page can undo one, so it lives outside React.
 */
export function undoneChoices() {
  let ids: ReadonlySet<number> = new Set();
  const listeners = new Set<() => void>();
  return {
    has: (id: number): boolean => ids.has(id),
    all: (): ReadonlySet<number> => ids,
    add(id: number): void {
      ids = new Set([...ids, id]);
      for (const listener of listeners) listener();
    },
    /** Forgets every undo: for a page that starts over against a new tracker, whose ids start again. */
    clear(): void {
      ids = new Set();
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The page's one record of undone choices. */
export const UNDONE = undoneChoices();
