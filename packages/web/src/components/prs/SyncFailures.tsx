import type { SyncFailure } from "@octotrack/core/schemas";
import { syncReason } from "../../lib/format.ts";
import { Callout } from "../ui/Callout.tsx";
import { Code } from "../ui/Note.tsx";

/**
 * Pull request status that has stopped updating looks exactly like status that is current, unless something says so:
 * one sentence per repo naming it, why, the command that fixes it when there is one, and when it recovers.
 */
export function SyncFailures({ failures }: { failures: readonly SyncFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <>
      {failures.map((failure) => {
        const reason = syncReason(failure.error);
        return (
          <Callout key={failure.repo} tone="warn" lead={`Pull request status is stale for ${failure.repo}`}>
            <br />
            {reason === "gh is not logged in" ? (
              <>
                gh is not logged in. Run <Code>gh auth login</Code>; it picks up again within two minutes.
              </>
            ) : (
              `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. It picks up again within two minutes of that being fixed.`
            )}
          </Callout>
        );
      })}
    </>
  );
}
