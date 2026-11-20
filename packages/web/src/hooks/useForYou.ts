import type { HomeView } from "@octotrack/core/schemas";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type Entry, entriesOf, type Filter, filterCounts, openEntry } from "../lib/forYou.ts";
import { setParams } from "../lib/router.ts";

/**
 * A view of For you as the page lives it: its entries in order, the one open, and moving between them. The open one is
 * in the address (?item=), so Back and a reload keep it; a notification's ?focus= opens its item too. When the open one
 * goes, answered or put off, the one that took its place opens; the address is outside React, so an effect brings it in
 * line.
 */
export function useForYou(home: HomeView | undefined, filter: Filter, asked: string | null) {
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
  // Put off: it goes to the bottom, and the one after it opens in its place.
  const putOff = useCallback(
    (ref: string) => {
      const at = entries.findIndex((entry) => entry.ref === ref);
      const after = [...entries.slice(at + 1), ...entries.slice(0, Math.max(at, 0))].find(
        (entry) => entry.ref !== ref && entry.laterAt === null,
      );
      if (after !== undefined) setParams({ item: after.ref, focus: null }, true);
    },
    [entries],
  );
  return { entries, counts, open, index, go, step, putOff };
}
