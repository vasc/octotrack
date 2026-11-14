import { contracts } from "@octotrack/core/contracts";
import { useEffect } from "react";
import { callOp } from "../api/client.ts";

/**
 * Tells the server the developer has looked at a line, when its panel opens: the log's not-seen starts after this.
 * The server is outside React, so this is an effect, once per line opened.
 */
export function useMarkSeen(line: string): void {
  useEffect(() => {
    void callOp(contracts.seen, { line }).catch(() => {});
  }, [line]);
}
