import { ErrorState, LoadingState } from "../ui/states.tsx";
import type { PullRequest } from "@octotrack/core/schemas";

const CHECKS: Readonly<Record<PullRequest["checks"], string>> = {
  none: "no checks",
  pending: "checks running",
  passing: "✓ checks pass",
  failing: "✗ checks failing",
};

/**
 * An issue's pull requests, each with its checks, size and state. Checks are agents' to fix, never the developer's:
 * the holder merges once they pass, and asks first when it wants the developer's eyes.
 */
export function PullRequestBox({
  prs,
  holder,
  loading = false,
  error = null,
}: {
  prs: readonly PullRequest[];
  holder: string | null;
  loading?: boolean;
  error?: Error | null;
}) {
  return (
    <section className="panel-section" aria-label="Pull request">
      <h2 className="panel-label">Pull request{prs.length === 1 ? "" : "s"}</h2>
      {loading ? <LoadingState label="Loading pull requests" /> : null}
      {error === null ? null : <ErrorState error={error} />}
      {prs.length === 0 && !loading && error === null ? <p className="muted">None yet.</p> : null}
      {prs.map((pr) => (
        <div key={pr.ref} className="pr-box">
          <span>
            <a className="mono panel-link" href={pr.url} target="_blank" rel="noreferrer">
              {pr.repo}#{pr.number}
            </a>{" "}
            <b>{pr.title}</b>
          </span>
          <span className="plan-checks" data-checks={pr.checks}>
            {CHECKS[pr.checks]}
          </span>
          <span className="muted">
            +{pr.additions} −{pr.deletions} · opened {pr.createdAt.slice(0, 10)}
          </span>
          <span className="muted">{pr.state}</span>
        </div>
      ))}
      <span className="muted">
        Checks are agents' to fix, never yours{holder === null ? "" : `, and ${holder} merges once they pass`}
        ; if it wants your eyes first, it asks.
      </span>
    </section>
  );
}
