import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const MIN_GAP_MS = 100;

export type LiveState = "connecting" | "live" | "offline";

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
export function useLiveUpdates(): LiveState {
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>("connecting");

  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRefresh = 0;

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
        refresh();
      });
      source.addEventListener("change", refresh);
      source.addEventListener("error", () => setState("offline"));
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
  }, [client]);

  return state;
}
