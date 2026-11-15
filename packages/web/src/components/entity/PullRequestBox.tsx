import type { PullRequest } from "@octotrack/core/schemas";
import { Link } from "../ui/Link.tsx";
import { whenText } from "../../lib/format.ts";
import { Fact, Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";

const CHECKS: Readonly<Record<PullRequest["checks"], string>> = {
  none: "no checks",
  pending: "checks running",
  passing: "✓ checks pass",
  failing: "✗ checks failing",
};

/** An issue's pull requests, each with its link, checks, size, when it was opened and its state. */
export function PullRequestBox({
  prs,
  loading = false,
  error = null,
}: {
  prs: readonly PullRequest[];
  loading?: boolean;
  error?: Error | null;
}) {
  return (
    <Section title="Pull requests" count={loading || error !== null ? undefined : prs.length}>
      {loading ? <LoadingState label="Loading pull requests" /> : null}
      {error === null ? null : <ErrorState error={error} />}
      {prs.length === 0 && !loading && error === null ? <Note>None yet</Note> : null}
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
                    {pr.repo}#{pr.number}
                  </Link>
                  {pr.checks === "failing" ? <Fact tone="stuck">{CHECKS.failing}</Fact> : CHECKS[pr.checks]}
                  {`+${pr.additions} −${pr.deletions}`}
                  {`opened ${whenText(pr.createdAt)}`}
                  {pr.state}
                </Facts>
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}
