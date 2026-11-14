import { contracts } from "@octotrack/core/contracts";
import { useEffect } from "react";
import { callOp } from "../api/client.ts";
import { useOpMutation } from "./useOp.ts";

/**
 * Tells the server the developer has looked at a line, when its panel opens: the log's not-seen starts after this.
 * The server is outside React, so this is an effect, once per line opened.
 */
export function useMarkSeen(line: string): void {
  useEffect(() => {
    void callOp(contracts.seen, { line }).catch(() => {});
  }, [line]);
}

/** Mark all seen: every line counts as looked at from now, so the log's not-seen starts empty. */
export function useMarkAllSeen() {
  const seen = useOpMutation(contracts.seen);
  return { markAll: () => seen.mutate({}), error: seen.error };
}
