import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";

/** The calmest state, and the most common good one: nothing waits on the developer; who is working, and on what. */
export function NothingNeedsYou({
  working,
  next,
}: {
  /** Agents running on lines now. */
  working: number;
  /** The first working line with a step still to do, where the next ask likely comes from. */
  next: { title: string; step: string | null } | null;
}) {
  return (
    <List>
      <Row
        label="Nothing needs you"
        title="Nothing needs you"
        facts={
          <Facts>
            {`${working === 0 ? "no" : working} agent${working === 1 ? "" : "s"} working`}
            {next === null
              ? null
              : `next ask likely on ${next.title}${next.step === null ? "" : `, ${next.step}`}`}
          </Facts>
        }
      />
    </List>
  );
}
