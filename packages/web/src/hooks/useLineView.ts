import { contracts } from "@octotrack/core/contracts";
import { sinceSummaryQuery } from "@octotrack/core/query";
import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { forYouCounts } from "../lib/lines.ts";
import { useRoute } from "../lib/router.ts";
import { useChoices } from "./useChoices.ts";
import { useDraft } from "./useDraft.ts";
import { useHome } from "./useHome.ts";
import { useLineChoices } from "./useLineChoices.ts";
import { useMarkSeen } from "./useMarkSeen.ts";
import { useNarrow } from "./useNarrow.ts";
import { useOpQuery } from "./useOp.ts";
import { usePlanActions } from "./usePlanActions.ts";

/**
 * Everything a line shows and does, wherever it is opened, in a peek or on its own page: its plan and what happened
 * since its summary, who is on it and what it needs from the developer, its moves, and the drafts of Tell and of work
 * the developer adds to a line they own. Opening it marks it seen.
 */
export function useLineView(line: Line) {
  const choices = useLineChoices(line);
  const { waiting: choicesWaiting } = useChoices();
  const h = useHome();
  const shown = useOpQuery(contracts.lineShow, { ref: line.ref });
  // The same changes home counts: not the developer's own moves, which need no telling.
  const since = useOpQuery(contracts.feedList, { query: sinceSummaryQuery(line.ref), limit: 50 });
  const tell = useDraft(`tell:${line.ref}`);
  const own = useDraft(`own:${line.ref}`);
  const unmarked = useMarkSeen(line.ref);
  // As it was when it opened: opening it marks the line seen, which must not fold what is being read now.
  const [seenAt] = useState(line.seenAt);
  const [starting, setStarting] = useState(false);
  const narrow = useNarrow();
  const plan = usePlanActions(line.ref);
  // Opened with t: straight to Tell.
  const telling = useRoute().params.get("act") === "tell";
  const home = h.home.data;
  const crew = home?.crews[line.ref];
  const details = home?.lines[line.ref];
  const forYou = details?.forYou ?? [];
  return {
    line,
    choices,
    choicesWaiting,
    h,
    home,
    shown,
    since,
    tell,
    own,
    unmarked,
    seenAt,
    starting,
    setStarting,
    narrow,
    plan,
    telling,
    crew,
    owner: crew?.owner?.name ?? null,
    order: home === undefined ? [] : [...home.working, ...home.upNext],
    live: line.state !== "done" && line.state !== "dropped",
    details,
    forYou,
    held: forYouCounts(forYou),
    // Why nobody can take the line, when it needs the developer to step in.
    stepIn: details?.stepIn === true ? details.stepInReason : null,
  };
}

export type LineView = ReturnType<typeof useLineView>;
