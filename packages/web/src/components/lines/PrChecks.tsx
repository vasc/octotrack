import type { PrChecks as Checks } from "@octotrack/core/schemas";
import { Mark } from "../ui/Badge.tsx";
import { Fact } from "../ui/Facts.tsx";

/**
 * A pull request's checks in a word or two: failing ones in the warm tone, since they hold the work up; passing ones a
 * check; running ones say so; checks never run say nothing.
 */
export function PrChecks({ checks }: { checks: Checks }) {
  if (checks === "failing")
    return (
      <Fact tone="stuck">
        <Mark tone="bad" icon="cross" />
        checks failing
      </Fact>
    );
  if (checks === "passing") return <Mark tone="good" icon="check" />;
  if (checks === "pending") return "checks running";
  return null;
}
