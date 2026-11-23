import { useEffect, useRef } from "react";

/**
 * Calls retry every so often while the caller is shown: a timer is outside React, so an effect keeps it, and a ref
 * keeps the latest retry without restarting the timer each render.
 */
export function useRetryEvery(everyMs: number, retry: () => void): void {
  const latest = useRef(retry);
  latest.current = retry;
  useEffect(() => {
    const timer = setInterval(() => latest.current(), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
}
