import type { LineWork } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { PrChecks } from "../lines/PrChecks.tsx";
import { Mark } from "../ui/Badge.tsx";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

type Pr = LineWork["prs"][number];

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
          <PrChecks checks={pr.checks} />
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
