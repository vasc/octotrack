import type { LineWork } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { Mark } from "../ui/Badge.tsx";
import { Fact, Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

type Pr = LineWork["prs"][number];

/** A pull request's checks in a word or two; failing ones in the warm tone, since they hold the work up. */
function ChecksWord({ checks }: { checks: Pr["checks"] }) {
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

/** An issue's state in words: "to do", "in progress". */
function statusWords(status: LineWork["status"]): string {
  return status === "todo" ? "to do" : humanize(status);
}

/** One pull request by its number, its state and its checks: "#418 open · checks failing", the last after a cross. */
function PrFact({ pr }: { pr: Pr }) {
  return (
    <>
      #{pr.number} {pr.state}
      {pr.checks === "none" ? null : (
        <>
          {" · "}
          <ChecksWord checks={pr.checks} />
        </>
      )}
    </>
  );
}

/**
 * The issues under a step, one row each: its ref and state, then its pull requests; on a phone several merged ones fold
 * to one fact, "4 pull requests merged" and a check, so the open work stands out.
 */
export function WorkList({ items, foldMerged }: { items: readonly LineWork[]; foldMerged: boolean }) {
  return (
    <List>
      {items.map((item) => {
        const merged = item.prs.filter((pr) => pr.state === "merged");
        const folded = foldMerged && merged.length > 1;
        const shown = folded ? item.prs.filter((pr) => pr.state !== "merged") : item.prs;
        return (
          <Row
            key={item.ref}
            title={item.title}
            facts={
              <Facts>
                <RefLink value={item.ref} />
                {statusWords(item.status)}
                {shown.map((pr) => (
                  <PrFact key={pr.ref} pr={pr} />
                ))}
                {folded ? (
                  <>
                    {`${merged.length} pull requests merged`}
                    <Mark tone="good" icon="check" />
                  </>
                ) : (
                  ""
                )}
              </Facts>
            }
          />
        );
      })}
    </List>
  );
}
