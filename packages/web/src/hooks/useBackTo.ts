import { contracts } from "@octotrack/core/contracts";
import { backEntity, useRoute } from "../lib/router.ts";
import { useOpQuery } from "./useOp.ts";

/**
 * The way back from a peek opened from another one: that one named by its title, as it was just open and so is already
 * loaded, or by its ref until it is; undefined when the peek was opened from the page.
 */
export function useBackTo(): { label: string; onBack(): void } | undefined {
  const from = useRoute().params.get("from");
  const detail = useOpQuery(contracts.entityShow, { ref: from ?? "" }, { enabled: from !== null });
  if (from === null) return undefined;
  const title = detail.isPlaceholderData ? undefined : detail.data?.summary.title;
  return { label: title ?? from, onBack: backEntity };
}
