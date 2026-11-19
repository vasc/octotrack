import type { PullRequest } from "@octotrack/core/schemas";
import { prKind, pushedSinceReady } from "../../lib/prs.ts";
import { Fact, Facts } from "../ui/Facts.tsx";
import { Link } from "../ui/Link.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { PrChecks } from "./PrChecks.tsx";

/** A review in a word or two; changes asked for in the warm tone, since they hold it up. */
function ReviewWord({ review }: { review: Exclude<PullRequest["review"], "none"> }) {
  if (review === "approved") return "approved";
  if (review === "requested") return "review requested";
  return <Fact tone="stuck">changes requested</Fact>;
}

/**
 * A line's pull requests still open, one row each, in the order given: those an agent said are ready to merge first,
 * saying so in the colour for what needs you, with who said it and why, and whether it was pushed to since. Each one's
 * name, owner/repo#number, leaves for GitHub, where it is merged.
 */
export function LinePrs({ prs }: { prs: readonly PullRequest[] }) {
  if (prs.length === 0) return null;
  return (
    <List>
      {prs.map((pr) => {
        const kind = prKind(pr);
        return (
          <Row
            key={pr.ref}
            label={`${kind}: ${pr.title}`}
            kind={kind}
            tone={kind === "Ready to merge" ? "needs" : "none"}
            title={pr.title}
            facts={
              <Facts>
                {/* Out to GitHub, where the pull request lives and is merged. */}
                <Link href={pr.url} external>
                  {pr.repo}#{pr.number}
                </Link>
                {pr.readyBy === null ? "" : `by ${pr.readyBy}`}
                {/* Ready, but still a draft on GitHub, which will not merge until it is marked ready for review. */}
                {kind === "Ready to merge" && pr.state === "draft" ? <Fact tone="stuck">draft</Fact> : ""}
                {/* Facts leave out only empty words, not a part that draws nothing, so those are left out here. */}
                {pr.checks === "none" ? "" : <PrChecks checks={pr.checks} />}
                {pr.review === "none" ? "" : <ReviewWord review={pr.review} />}
                {pushedSinceReady(pr) ? <Fact tone="stuck">pushed to since</Fact> : ""}
              </Facts>
            }
            {...(pr.readyWhy === null ? {} : { note: pr.readyWhy })}
          />
        );
      })}
    </List>
  );
}
