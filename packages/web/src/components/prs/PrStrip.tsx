import type { PrCard } from "@octotrack/core/schemas";
import { navigate } from "../../lib/router.ts";
import { Badge } from "../ui/Badge.tsx";

const SIGNALS = [
  { attention: "checks failing", label: "failing", tone: "bad" },
  { attention: "merge conflict", label: "conflicting", tone: "bad" },
  { attention: "changes requested", label: "changes requested", tone: "bad" },
  { attention: "needs review", label: "need review", tone: "warn" },
  { attention: "ready to merge", label: "ready to merge", tone: "good" },
] as const;

/** PR status for screens too narrow for the rail. PR status should never be more than a glance away. */
export function PrStrip({ cards }: { cards: readonly PrCard[] }) {
  const open = cards.filter((card) => card.pr.state === "open" || card.pr.state === "draft");
  if (open.length === 0) return null;
  return (
    <button type="button" className="pr-strip" onClick={() => navigate("/prs")}>
      <span>{open.length} open PRs</span>
      {SIGNALS.map((signal) => {
        const count = open.filter((card) => card.attention.includes(signal.attention)).length;
        return count === 0 ? null : (
          <Badge key={signal.label} tone={signal.tone}>
            {count} {signal.label}
          </Badge>
        );
      })}
    </button>
  );
}
