import { useEffect, useState } from "react";

/**
 * The time now, in milliseconds, kept current every `everyMs` while on: the clock is outside React, so an effect brings
 * it in. Off, it costs nothing.
 */
export function useClock(on: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [on, everyMs]);
  return now;
}
