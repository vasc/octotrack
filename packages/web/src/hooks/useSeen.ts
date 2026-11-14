import { contracts } from "@octotrack/core/contracts";
import { useEffect } from "react";
import { callOp } from "../api/client.ts";

/**
 * Tells the server whenever the developer has the app in front of them, which lets each line buzz the phone once more.
 * An effect, because visibility is the browser's state, not React's.
 */
export function useSeen(): void {
  useEffect(() => {
    const seen = () => {
      if (document.visibilityState === "visible") void callOp(contracts.pushSeen, {}).catch(() => {});
    };
    seen();
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, []);
}
