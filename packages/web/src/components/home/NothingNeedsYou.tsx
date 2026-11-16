import { Facts } from "../ui/Facts.tsx";
import { Notice } from "../ui/Notice.tsx";

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
    <Notice title="Nothing needs you">
      <Facts>
        {`${working === 0 ? "no" : working} agent${working === 1 ? "" : "s"} working`}
        {next === null
          ? null
          : `the next ask likely comes from ${next.title}${next.step === null ? "" : `, ${next.step}`}`}
      </Facts>
    </Notice>
  );
}
