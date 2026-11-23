import { useEffect, useState } from "react";
import { loadedAssets, newBuild } from "../lib/build.ts";

type Options = {
  /** The built files this page has loaded. */
  loaded?: () => readonly string[];
  /** The page as the server serves it now. */
  fetchPage?: () => Promise<string>;
  reload?: () => void;
};

const servedPage = () => fetch("/", { cache: "no-store" }).then((response) => response.text());

/** Where a tab notes the build it last reloaded for, so the same build never reloads it twice. */
const RELOADED_FOR = "octotrack.reloadedFor";

/** The build this tab last reloaded for, if it could be read. */
function reloadedFor(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_FOR);
  } catch {
    return null;
  }
}

function noteReload(build: string): void {
  try {
    sessionStorage.setItem(RELOADED_FOR, build);
  } catch {
    // Without storage the guard is off; the reload still happens once per return to the tab.
  }
}

/** Whether someone is typing: a reload then would take the words not yet kept. */
function typing(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLInputElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}

/**
 * An open tab picks up a deploy by itself. A phone keeps a tab's code for days, so without this a fix never reaches the
 * page the developer has open. Whenever the page comes back into view, or Safari restores it from memory, the served
 * page is read; if it loads a script or stylesheet this page did not, the page reloads, unless a box has focus. Then
 * the new build is waiting, said under the bar with Load it now, and loads at the next return to the tab. A tab reloads
 * for one build only once, so a page that keeps differing waits instead of looping. Drafts are kept on the server as
 * they are typed, so nothing else is lost.
 */
export function useReloadOnNewBuild({
  loaded = loadedAssets,
  fetchPage = servedPage,
  reload = () => window.location.reload(),
}: Options = {}): { waiting: boolean; loadNow(): void } {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    let checking = false;
    const check = () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      fetchPage()
        .then((page) => {
          const fresh = newBuild(loaded(), page);
          if (fresh.length === 0) return;
          const build = fresh.join(" ");
          // Reloaded once for this build and still not on it: something between keeps the old page. It waits, said
          // under the bar, rather than reloading in a loop.
          if (typing() || reloadedFor() === build) {
            setWaiting(true);
            return;
          }
          noteReload(build);
          reload();
        })
        .catch(() => {
          // Offline or restarting: the next return to the page checks again.
        })
        .finally(() => {
          checking = false;
        });
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
    };
  }, [loaded, fetchPage, reload]);
  return { waiting, loadNow: reload };
}
