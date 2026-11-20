import type { HomeView, PendingChoice } from "@octotrack/core/schemas";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  type Entry,
  entriesOf,
  type Filter,
  filterCounts,
  forYouPath,
  nextFilter,
  openEntry,
} from "../lib/forYou.ts";
import { navigate, setParams } from "../lib/router.ts";
import { UNDONE } from "../lib/undone.ts";

/**
 * A view of For you as the page lives it: its entries in order, the one open, and moving between them. The open one is
 * in the address (?item=), so Back and a reload keep it; a notification's ?focus= opens its item too. When the open one
 * goes, answered or put off, the one that took its place opens; the address is outside React, so an effect brings it in
 * line.
 */
export function useForYou(
  home: HomeView | undefined,
  filter: Filter,
  asked: string | null,
  /** The choices made lately, waiting with Undo or settled. */
  choices: readonly PendingChoice[],
) {
  const entries = useMemo(() => (home === undefined ? [] : entriesOf(home, filter)), [home, filter]);
  const counts = useMemo(() => (home === undefined ? null : filterCounts(home)), [home]);
  // The list as it was last drawn, to find what comes after an entry that has gone from it.
  const before = useRef<string[]>([]);
  const open: Entry | null = openEntry(entries, asked, before.current);
  useEffect(() => {
    before.current = entries.map((entry) => entry.ref);
  }, [entries]);
  // The address names the one open, once the list has loaded.
  useEffect(() => {
    if (home === undefined) return;
    const shown = open?.ref ?? null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("item") !== shown || params.has("focus")) setParams({ item: shown, focus: null }, true);
  }, [home, open?.ref]);
  const go = useCallback((ref: string) => setParams({ item: ref, focus: null }), []);
  const index = open === null ? -1 : entries.indexOf(open);
  const step = useCallback(
    (forward: boolean) => {
      const target = entries[index + (forward ? 1 : -1)];
      if (target !== undefined) go(target.ref);
    },
    [entries, index, go],
  );
  // A view emptied by what was done in it hands on to the next view that holds something, as its last item said it
  // would; a view opened empty stays, saying so. The address is outside React, so an effect moves it.
  const heldSome = useRef<Filter | null>(null);
  useEffect(() => {
    if (counts === null) return;
    if (entries.length > 0) {
      heldSome.current = filter;
      return;
    }
    if (heldSome.current !== filter) return;
    heldSome.current = null;
    const next = nextFilter(counts, filter);
    if (next !== null) navigate(forYouPath(next), true);
  }, [entries, counts, filter]);
  // The item moved on from, and once its choice is seen waiting, which choice that is.
  const [left, setLeft] = useState<{ ref: string; choice: number | null } | null>(null);
  const undone = useSyncExternalStore(UNDONE.subscribe, UNDONE.all);
  // Answered, done or put off: it waits with Undo, or goes to the bottom, and the one after it opens in its place.
  const moveOn = useCallback(
    (ref: string) => {
      setLeft({ ref, choice: null });
      const at = entries.findIndex((entry) => entry.ref === ref);
      const after = [...entries.slice(at + 1), ...entries.slice(0, Math.max(at, 0))].find(
        (entry) => entry.ref !== ref && entry.laterAt === null,
      );
      if (after !== undefined) setParams({ item: after.ref, focus: null }, true);
    },
    [entries],
  );
  // Its choice undone, the item opens again where it was left; taken effect or failed, nothing reopens. The choices are
  // the server's, outside React, so an effect follows them.
  useEffect(() => {
    if (left === null) return;
    if (left.choice === null) {
      const waiting = choices.find((choice) => choice.state === "pending" && standsFor(choice, left.ref));
      if (waiting !== undefined) setLeft({ ref: left.ref, choice: waiting.id });
      return;
    }
    const state = choices.find((choice) => choice.id === left.choice)?.state;
    if (state === "pending") return;
    setLeft(null);
    if (undone.has(left.choice)) setParams({ item: left.ref, focus: null }, true);
  }, [left, choices, undone]);
  return { entries, counts, open, index, go, step, moveOn };
}

/** Whether a choice is about this entry: a question or task by its ref, or a line's own items by the line. */
function standsFor(choice: PendingChoice, ref: string): boolean {
  if (choice.ref === null) return false;
  return [choice.ref, `stepin:${choice.ref}`, `done:${choice.ref}`, `done_when:${choice.ref}`].includes(ref);
}
