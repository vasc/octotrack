import type { SyncFailure } from "@octotrack/core/schemas";
import { Callout } from "../ui/Callout.tsx";

/** The first line of what the sync said, as a sentence. */
function firstLine(error: string): string {
  const line = (error.split("\n")[0] ?? "").trim().replace(/[.:]$/, "");
  return line === "" ? "The sync failed" : line;
}

/**
 * Pull request status that has stopped updating looks exactly like status that is current, unless something says so:
 * one sentence per repo naming it, why, and that it picks up again by itself.
 */
export function SyncFailures({ failures }: { failures: readonly SyncFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <>
      {failures.map((failure) => (
        <Callout key={failure.repo} tone="warn" lead={`Pull request status is stale for ${failure.repo}`}>
          <br />
          {firstLine(failure.error)}. It picks up again by itself once that is fixed.
        </Callout>
      ))}
    </>
  );
}
