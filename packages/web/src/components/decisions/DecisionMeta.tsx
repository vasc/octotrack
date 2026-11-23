import type { Decision } from "@octotrack/core/schemas";
import { shortDate } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** Where an answer was given, as words that follow "on". */
const CHANNEL_WORDS: Readonly<Record<string, string>> = {
  dashboard: "the dashboard",
  cli: "the command line",
  out_of_band: "a call or a chat, recorded after",
};

/**
 * What a question is, as a row of small facts that lead with its state: "Held · D-65 · asked by travel-agent · 9d", or
 * "Answered · D-20 · by you on the dashboard · 7 Nov".
 */
export function DecisionMeta({
  decision,
  state,
  now,
}: {
  decision: Decision;
  /** Its state in a word, such as Held or Answered. */
  state: string;
  now?: number;
}) {
  const answered = decision.decidedAt !== null;
  const by = decision.decidedBy === null ? null : decision.decidedBy === "dev" ? "you" : decision.decidedBy;
  return (
    <Facts>
      <Kind tone={answered ? "none" : "needs"}>{state}</Kind>
      <RefLink value={decision.ref} />
      {answered
        ? by === null
          ? null
          : `by ${by}${decision.channel === null ? "" : ` on ${CHANNEL_WORDS[decision.channel] ?? decision.channel}`}`
        : `asked by ${decision.requestedBy}`}
      {answered && decision.decidedAt !== null ? (
        shortDate(decision.decidedAt, now)
      ) : (
        <TimeAgo iso={decision.createdAt} {...(now === undefined ? {} : { now })} />
      )}
    </Facts>
  );
}
