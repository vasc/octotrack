import type { HomeView } from "@octotrack/core/schemas";
import { type RefObject, useEffect } from "react";
import { setParams } from "../lib/router.ts";
import { useBrowserFocus } from "./useBrowserFocus.ts";
import { useHomeFocus } from "./useHomeFocus.ts";

/**
 * Home's focus as the page lives it: kept by useHomeFocus, mirrored to the browser's own focus, and moved by a count or
 * a buzz that names an item with ?focus. Once focus is there the URL lets it go, so the same count or buzz works again
 * after focus has moved on; the URL is outside React, so an effect brings it in line.
 */
export function useHomeFocusOnPage(
  page: RefObject<HTMLElement | null>,
  home: HomeView | undefined,
  asked: string | null,
  held: ReadonlySet<string>,
) {
  const focusState = useHomeFocus(home, asked, held);
  const { focus, follow, moved } = focusState;
  useBrowserFocus(page, focus, moved, follow);
  useEffect(() => {
    if (asked !== null && focus === asked) setParams({ focus: null }, true);
  }, [asked, focus]);
  return focusState;
}
