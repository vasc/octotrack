import { useEffect } from "react";
import { newBuild, RUNNING_SCRIPT } from "../lib/build.ts";

type Options = {
  /** The script this page runs. */
  running?: string;
  /** The page as the server serves it now. */
  fetchPage?: () => Promise<string>;
  reload?: () => void;
};

const servedPage = () => fetch("/", { cache: "no-store" }).then((response) => response.text());

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
 * page is read; if it names another build, the page reloads, unless a box has focus. Drafts are kept on the server as
 * they are typed, so nothing else is lost.
 */
export function useReloadOnNewBuild({
  running = RUNNING_SCRIPT,
  fetchPage = servedPage,
  reload = () => window.location.reload(),
}: Options = {}): void {
  useEffect(() => {
    let checking = false;
    const check = () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      fetchPage()
        .then((page) => {
          if (newBuild(running, page) !== null && !typing()) reload();
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
  }, [running, fetchPage, reload]);
}
