import type { PullRequest } from "@octotrack/core/schemas";
import { Link } from "../ui/Link.tsx";
import { Fact, Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import type { ReactNode } from "react";
import { Mark } from "../ui/Badge.tsx";

const CHECKS: Readonly<Record<Exclude<PullRequest["checks"], "none">, ReactNode>> = {
  pending: "checks running",
  passing: (
    <>
      <Mark tone="good" icon="check" />
      checks pass
    </>
  ),
  failing: (
    <>
      <Mark tone="bad" icon="cross" />
      checks failing
    </>
  ),
};

/**
 * An issue's pull requests, one row each: its title, then its number, which leaves for GitHub, its state and its checks:
 * "#418 open · checks failing", the last after a cross. Checks never run are not mentioned.
 */
export function PullRequestBox({
  prs,
  loading = false,
  error = null,
  onRetry,
}: {
  prs: readonly PullRequest[];
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  return (
    <Section title="Pull requests" count={loading || error !== null ? undefined : prs.length}>
      {loading ? <LoadingState label="Loading pull requests" /> : null}
      {error === null ? null : (
        <ErrorState
          title="Could not load the pull requests."
          error={error}
          {...(onRetry === undefined ? {} : { onRetry })}
        />
      )}
      {prs.length === 0 && !loading && error === null ? <Note>None yet.</Note> : null}
      {prs.length === 0 ? null : (
        <List>
          {prs.map((pr) => (
            <Row
              key={pr.ref}
              title={pr.title}
              facts={
                <Facts>
                  {/* Out to GitHub, where the pull request lives. */}
                  <Link href={pr.url} external>
                    #{pr.number}
                  </Link>
                  {pr.state}
                  {pr.checks === "none" ? (
                    ""
                  ) : pr.checks === "failing" ? (
                    <Fact tone="stuck">{CHECKS.failing}</Fact>
                  ) : (
                    CHECKS[pr.checks]
                  )}
                </Facts>
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}
