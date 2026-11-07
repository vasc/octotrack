import type { SyncFailure } from "@octotrack/core/schemas";

/** PR status that has stopped updating looks exactly like PR status that is current, unless something says so. */
export function SyncFailures({ failures }: { failures: readonly SyncFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <ul className="sync-failures" aria-label="PR sync problems">
      {failures.map((failure) => (
        <li key={failure.repo} className="error-text">
          PR status is stale for {failure.repo}: {failure.error}
        </li>
      ))}
    </ul>
  );
}
