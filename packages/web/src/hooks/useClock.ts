import { useEffect, useState } from "react";

/**
 * The time now, in milliseconds, kept current every second while on: the clock is outside React, so an effect brings
 * it in. Off, it costs nothing.
 */
export function useClock(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [on]);
  return now;
}
