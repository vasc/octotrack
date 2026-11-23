import { contracts } from "@octotrack/core/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useState } from "react";

const MIN_GAP_MS = 100;

const DraftNotice = z.object({ key: z.string() });

export type LiveState = "connecting" | "live" | "offline";

export interface Live {
  state: LiveState;
  /** When the connection was lost, while it is: what is shown was true then. */
  offlineSince: number | null;
  /** Gives up the connection being retried and opens a new one at once. */
  reconnect(): void;
}

/**
 * Keeps every visible query current, so that anything an agent does shows up without a reload. An external stream
 * coming into React is what useEffect is for.
 *
 * The first change refreshes at once. Only a burst is held back, into at most one refresh per gap.
 *
 * Every connection refreshes when it opens, the first one included. Whatever landed between the page's first load and
 * the stream connecting would otherwise stay invisible until the next change, and that costs a few cheap local requests.
 *
 * A hidden tab closes its stream, because browsers allow about six connections to one host: with enough open tabs,
 * every further request would hang. It catches up through that same refresh when it comes back.
 */
export function useLiveUpdates(): Live {
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>("connecting");
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  // Each Try now is a new attempt: the connection is opened afresh.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRefresh = 0;
    // A retry starts over as connecting; it is offline again only if this attempt fails too.
    if (attempt > 0) setState("connecting");

    const runRefresh = () => {
      lastRefresh = Date.now();
      void client.invalidateQueries();
    };
    const refresh = () => {
      if (timer !== null) return;
      const wait = lastRefresh + MIN_GAP_MS - Date.now();
      if (wait <= 0) {
        runRefresh();
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        runRefresh();
      }, wait);
    };
    const connect = () => {
      if (source !== null) return;
      source = new EventSource("/api/stream");
      source.addEventListener("hello", () => {
        setState("live");
        setOfflineSince(null);
        refresh();
      });
      source.addEventListener("change", refresh);
      // A draft saved on another device: only that draft is fetched again, so typing elsewhere refreshes nothing else.
      source.addEventListener("draft", (event: { data: string }) => {
        const notice = DraftNotice.safeParse(JSON.parse(event.data));
        if (notice.success) {
          void client.invalidateQueries({ queryKey: [contracts.draftGet.name, { key: notice.data.key }] });
        }
      });
      source.addEventListener("error", () => {
        setState("offline");
        setOfflineSince((since) => since ?? Date.now());
      });
    };
    const disconnect = () => {
      source?.close();
      source = null;
      setState("connecting");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") disconnect();
      else connect();
    };

    if (document.visibilityState !== "hidden") connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== null) clearTimeout(timer);
      source?.close();
    };
  }, [client, attempt]);

  return { state, offlineSince, reconnect: () => setAttempt((count) => count + 1) };
}
