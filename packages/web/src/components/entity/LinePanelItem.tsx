import { contracts } from "@octotrack/core/contracts";
import { sinceSummaryQuery } from "@octotrack/core/query";
import type { Drift, Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useLineChoices } from "../../hooks/useLineChoices.ts";
import { useMarkSeen } from "../../hooks/useMarkSeen.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { failureText } from "../../lib/failure.ts";
import { forYouCounts, issuesOnBranch } from "../../lib/lines.ts";
import { moreSinceSummary } from "../../lib/log.ts";
import { backEntity, pageUnder, useRoute } from "../../lib/router.ts";
import { LineStepIn } from "../home/LineStepIn.tsx";
import { StartSheet } from "../home/StartSheet.tsx";
import { Loaded, StaleNote } from "../ui/Loaded.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { Note } from "../ui/Note.tsx";
import { LineActions } from "./LineActions.tsx";
import { LinePanelHead } from "./LinePanelHead.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { OwnerBox } from "./OwnerBox.tsx";
import { OwnWorkBox } from "./OwnWorkBox.tsx";
import { PanelForYou } from "./PanelForYou.tsx";
import { PlanList } from "./PlanList.tsx";
import { SinceSummary } from "./SinceSummary.tsx";
import { SummaryBox } from "./SummaryBox.tsx";
import { TellBox } from "./TellBox.tsx";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { usePlanActions } from "../../hooks/usePlanActions.ts";
import { BranchEditSheet } from "../lines/BranchEditSheet.tsx";
import { PromoteSheet } from "../lines/PromoteSheet.tsx";

/**
 * A line opened, in one column read top to bottom: where it stands and how to move it, what it needs from you, its
 * summary, its plan, what happened, who owns it, then Tell. Opening it marks it seen.
 */
export function LinePanelItem({
  line,
  drift,
  stale = null,
  staleAt,
  onRetry,
}: {
  line: Line;
  drift: readonly Drift[];
  /** Why the panel could not refresh, once it had loaded: what it shows may be out of date. */
  stale?: Error | null;
  /** When what is shown was last loaded, for a stale panel to say. */
  staleAt?: number;
  /** Loads it again, after a refresh that failed. */
  onRetry?: () => void;
}) {
  const choices = useLineChoices(line);
  const { waiting: choicesWaiting } = useChoices();
  const h = useHome();
  const shown = useOpQuery(contracts.lineShow, { ref: line.ref });
  // The same changes home counts: not the developer's own moves, which need no telling.
  const since = useOpQuery(contracts.feedList, { query: sinceSummaryQuery(line.ref), limit: 50 });
  const tell = useDraft(`tell:${line.ref}`);
  const own = useDraft(`own:${line.ref}`);
  const unmarked = useMarkSeen(line.ref);
  // As it was when the panel opened: opening it marks the line seen, which must not fold what is being read now.
  const [seenAt] = useState(line.seenAt);
  const [starting, setStarting] = useState(false);
  const route = useRoute();
  const narrow = useNarrow();
  const plan = usePlanActions(line.ref);
  const params = route.params;
  // Opened with t from home: straight to Tell.
  const telling = params.get("act") === "tell";
  // Opened from another panel: Back returns there.
  const from = params.get("from");
  const home = h.home.data;
  const crew = home?.crews[line.ref];
  const owner = crew?.owner?.name ?? null;
  const order = home === undefined ? [] : [...home.working, ...home.upNext];
  const live = line.state !== "done" && line.state !== "dropped";
  const details = home?.lines[line.ref];
  const forYou = details?.forYou ?? [];
  // Until Lines has loaded once, who owns the line and what it needs from the developer are not known: say so.
  const homeStatus = (what: string) =>
    home === undefined ? (
      <Loaded loaded={false} error={h.home.error} what={what} onRetry={() => void h.home.refetch()}>
        {null}
      </Loaded>
    ) : undefined;
  // Why nobody can take the line, when it needs the developer to step in.
  const stepIn = details?.stepIn === true ? details.stepInReason : null;
  return (
    <LinePanelHead
      under={pageUnder(route.path)}
      line={line}
      repos={line.repos.map(h.repoName)}
      held={forYouCounts(forYou)}
      back={from === null ? undefined : { label: from, onBack: backEntity }}
      branchOf={shown.data?.branchOf ?? null}
      actions={
        stepIn !== null && details !== undefined && details.stepInKind !== null ? (
          // Nobody can take it: Step in, its reason and the action that fits, in place of the moves.
          <LineStepIn
            line={line}
            reason={stepIn}
            kind={details.stepInKind}
            focused={false}
            folded={false}
            h={h}
            onFocus={() => {}}
          />
        ) : starting ? (
          <StartSheet
            line={line}
            onDoneWhen={h.doneWhen}
            onStart={(ref) => {
              h.start(ref);
              setStarting(false);
            }}
            onCancel={() => setStarting(false)}
          />
        ) : (
          <LineActions
            line={line}
            owner={owner}
            // A line that waited may hold questions and tasks, so Start goes through its Start sheet.
            onChoose={(choice) =>
              choice === "start" && (line.state === "up_next" || line.state === "tabled")
                ? setStarting(true)
                : choices.choose(choice)
            }
            onTable={choices.table}
            foldTargets={order.filter((other) => other.ref !== line.ref)}
            onFold={(into) => h.fold(line.ref, into)}
            held={forYouCounts(forYou)}
          />
        )
      }
    >
      {stale === null ? null : <StaleNote at={staleAt} what={line.ref} onRetry={onRetry} />}
      {unmarked === null ? null : (
        <Note error hint={failureText(unmarked).hint}>
          Could not mark {line.ref} seen. {failureText(unmarked).text}
        </Note>
      )}
      <PanelForYou title={line.title} items={forYou} h={h} status={homeStatus("what needs you")} />
      <SummaryBox line={line} />
      <OpenDrift drift={drift} />
      <Loaded
        loaded={shown.data !== undefined}
        error={shown.error}
        what="the plan"
        onRetry={() => void shown.refetch()}
        at={shown.dataUpdatedAt}
      >
        <PlanList
          steps={shown.data?.steps ?? []}
          branches={shown.data?.branches ?? []}
          work={shown.data?.work ?? []}
          state={line.state}
          foldMerged={narrow}
          actions={plan.actions}
        />
      </Loaded>
      {plan.editing === null ? null : (
        <BranchEditSheet
          branch={plan.editing.branch}
          steps={plan.editing.steps}
          onSave={plan.save}
          onCancel={plan.cancel}
        />
      )}
      {plan.promoting === null ? null : (
        <PromoteSheet
          branch={plan.promoting}
          issues={issuesOnBranch(shown.data, plan.promoting)}
          onPromote={plan.promote}
          onCancel={plan.cancel}
        />
      )}
      <Loaded
        loaded={since.data !== undefined}
        error={since.error}
        what="what happened"
        onRetry={() => void since.refetch()}
        at={since.dataUpdatedAt}
      >
        <SinceSummary
          line={line.ref}
          events={since.data?.events ?? []}
          summaryAt={line.summaryAt}
          seenAt={seenAt}
          more={moreSinceSummary(since.data?.events ?? [], line.summaryAt, since.data?.nextBefore ?? null)}
        />
      </Loaded>
      <OwnerBox
        line={line}
        crew={crew}
        repoNames={line.repos.map(h.repoName)}
        onStop={choices.stop}
        onOwn={() => choices.choose("own")}
        waitingOnYou={home?.lines[line.ref]?.waitingOnYou === true}
        status={homeStatus("the owner")}
        ownInHead={stepIn !== null}
      />
      {!live ? null : line.ownedBy !== null ? (
        <OwnWorkBox
          line={line.ref}
          words={own.value}
          onWords={own.change}
          onTask={(title) => void own.flush().then(() => choices.addTask(title))}
          onNote={(body) => void own.flush().then(() => choices.addNote(body))}
          repos={line.repos}
          allRepos={h.repos}
          onHand={choices.hand}
          sending={choicesWaiting(`own:${line.ref}`)}
        />
      ) : line.state === "working" ? (
        <TellBox
          line={line.ref}
          to={owner}
          words={tell.value}
          onWords={tell.change}
          focus={telling}
          sending={choicesWaiting(`tell:${line.ref}`)}
          onSend={(words) => void tell.flush().then(() => choices.tell(words))}
        />
      ) : null}
      <NotKept unsaved={(tell.error ?? own.error) !== null} />
    </LinePanelHead>
  );
}
