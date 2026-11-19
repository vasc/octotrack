import { HomeCounts, type HomeView } from "@octotrack/core/schemas";
import { type RefObject, useEffect, useRef } from "react";
import { nextOf } from "../lib/focus.ts";
import { setParams } from "../lib/router.ts";
import { useBrowserFocus } from "./useBrowserFocus.ts";
import { useHomeFocus } from "./useHomeFocus.ts";

/**
 * Home's focus as the page lives it: kept by useHomeFocus, mirrored to the browser's own focus, and moved by a buzz that
 * names an item with ?focus, or by a count in the bar with ?next, which names the count. Once focus is there the URL
 * lets it go, so the same count or buzz works again; the URL is outside React, so effects bring it in line.
 */
export function useHomeFocusOnPage(
  page: RefObject<HTMLElement | null>,
  home: HomeView | undefined,
  asked: string | null,
  held: ReadonlySet<string>,
  next: string | null = null,
) {
  const focusState = useHomeFocus(home, asked, held);
  const { focus, follow, moved, choose } = focusState;
  useBrowserFocus(page, focus, moved, follow);
  useEffect(() => {
    if (asked !== null && focus === asked) setParams({ focus: null }, true);
  }, [asked, focus]);
  // A count pressed on another page arrives with home: it goes to the first such item, since focus there was not chosen.
  const arrivedWith = useRef(next);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus is read when a count is pressed, not when it changes
  useEffect(() => {
    if (next === null || home === undefined) return;
    setParams({ next: null }, true);
    const from = arrivedWith.current === next ? null : focus;
    arrivedWith.current = null;
    const count = HomeCounts.keyof().safeParse(next);
    if (!count.success) return;
    const target = nextOf(home, count.data, from);
    if (target !== null) choose(target);
  }, [next, home, choose]);
  return focusState;
}
