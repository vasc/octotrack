import type { ForYou } from "@octotrack/core/schemas";
import { useState } from "react";
import { useHome } from "../../hooks/useHome.ts";
import { useHomeFocus } from "../../hooks/useHomeFocus.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { usePush } from "../../hooks/usePush.ts";
import { useRoute } from "../../lib/router.ts";
import { refOf } from "../../lib/focus.ts";
import { stepInReason } from "../../lib/lines.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { AddLineForm } from "../lines/AddLineForm.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { FoldedSection } from "./FoldedSection.tsx";
import { ForYouItem } from "./ForYouItem.tsx";
import { HomeCounts } from "./HomeCounts.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { ProposalCard } from "./ProposalCard.tsx";
import { PushToggle } from "./PushToggle.tsx";
import { QuietRow } from "./QuietRow.tsx";
import { ReorderButtons } from "./ReorderButtons.tsx";
import { StepIn } from "./StepIn.tsx";
import { UpNextRow } from "./UpNextRow.tsx";
import { WorkingLine } from "./WorkingLine.tsx";

/** Every line, in the developer's order, with what each needs from them in place. */
export function HomePage() {
  const h = useHome();
  const push = usePush();
  const { params } = useRoute();
  // A tapped notification opens its question focused.
  const asked = params.get("focus");
  const narrow = useNarrow();
  const home = h.home.data;
  const { focus, armed, choose: setChosen, keys } = useHomeFocus(home, asked, h.held);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [reordering, setReordering] = useState(false);
  useHotkeys(keys);

  const item = (title: string) => (forYou: ForYou) => (
    <ForYouItem
      key={refOf(forYou)}
      item={forYou}
      title={title}
      onLineDone={h.lineDone}
      onNotYet={h.notYet}
      onDoneWhen={h.doneWhen}
      focused={refOf(forYou) === focus}
      armed={armed}
      onOpen={setChosen}
      onTaskDone={h.taskDone}
      onTaskCant={h.taskCant}
    />
  );
  const reorder = (title: string, ref: string, index: number, count: number) =>
    reordering ? (
      <ReorderButtons
        title={title}
        canMoveUp={index > 0}
        canMoveDown={index < count - 1}
        onMove={(direction) => h.reorder(ref, direction)}
      />
    ) : null;

  return (
    <div className="page">
      <PageHead title="Lines">
        <PushToggle state={push.state} error={push.error} onTurnOn={() => void push.turnOn()} />
        <button
          type="button"
          className="btn"
          aria-pressed={reordering}
          onClick={() => setReordering(!reordering)}
        >
          {reordering ? "Done reordering" : "Reorder"}
        </button>
      </PageHead>
      {home === undefined ? null : <HomeCounts counts={home.counts} />}
      <AddLineForm repos={h.repos} onAdd={h.add} />
      {h.failure === null ? null : <ErrorState error={h.failure} />}
      {h.home.isPending ? <LoadingState /> : null}
      {h.home.error === null ? null : <ErrorState error={h.home.error} />}
      {home === undefined ? null : (
        <>
          {home.working.length === 0 && home.upNext.length === 0 ? (
            <FirstRun proposals={home.proposed} onAccept={h.acceptRecommended} />
          ) : null}
          {home.urgent.length === 0 ? null : (
            <HomeSection title="Urgent" count={home.urgent.length}>
              {home.urgent.map((card) => (
                <DecisionCardItem
                  key={card.decision.ref}
                  card={card}
                  active={card.decision.ref === focus}
                  armed={armed && card.decision.ref === focus}
                />
              ))}
            </HomeSection>
          )}
          <HomeSection title="Working on" count={home.working.length} note="your order is everyone's order">
            {home.working.length === 0 ? <p className="muted">Nothing is being worked on.</p> : null}
            {home.working.map((line, index) => {
              const details = home.lines[line.ref];
              const crew = home.crews[line.ref];
              const forYou = details?.forYou ?? [];
              const start = details?.start ?? null;
              // Whether to step in is the server's rule, shared with the phone's buzz: not while the line's work all
              // waits on the developer, nor while a failed start is about to be retried by itself.
              const stepIn = details?.stepIn === true ? stepInReason(line, home.runner, start) : null;
              const retryable = start?.state === "failed" || start?.state === "never_took";
              const [first, ...rest] = forYou;
              const open = expanded.has(line.ref) || rest.some((other) => refOf(other) === focus);
              // On a phone, lines past the second fold to one row saying how much waits, unless one of theirs has focus.
              const folded = narrow && index >= 2 && !forYou.some((other) => refOf(other) === focus);
              return (
                <WorkingLine
                  key={line.ref}
                  index={index + 1}
                  line={line}
                  {...(crew === undefined ? {} : { crew })}
                  {...(details === undefined ? {} : { details })}
                  reorder={reorder(line.title, line.ref, index, home.working.length)}
                >
                  {stepIn === null ? null : (
                    <StepIn
                      line={line}
                      reason={stepIn}
                      {...(retryable ? { onRetry: h.retry } : {})}
                      onOwn={h.own}
                      onTable={h.table}
                    />
                  )}
                  {first === undefined ? null : folded ? (
                    <button type="button" className="chip" onClick={() => setChosen(refOf(first))}>
                      {forYou.length} waiting on you
                    </button>
                  ) : (
                    <div className="home-items">{item(line.title)(first)}</div>
                  )}
                  {rest.length === 0 || folded ? null : open ? (
                    <div className="home-items">{rest.map(item(line.title))}</div>
                  ) : (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setExpanded(new Set([...expanded, line.ref]))}
                    >
                      +{rest.length} more for you
                    </button>
                  )}
                </WorkingLine>
              );
            })}
          </HomeSection>
          <HomeSection
            title="Up next"
            count={home.upNext.length}
            note="scoped by idle agents, built once you start them"
          >
            {home.upNext.length === 0 ? <p className="muted">Nothing is up next.</p> : null}
            <div className="rows">
              {home.upNext.map((line, index) => {
                const details = home.lines[line.ref];
                const crew = home.crews[line.ref];
                return (
                  <UpNextRow
                    key={line.ref}
                    index={home.working.length + index + 1}
                    line={line}
                    {...(crew === undefined ? {} : { crew })}
                    {...(details === undefined ? {} : { details })}
                    reorder={reorder(line.title, line.ref, index, home.upNext.length)}
                    onStart={h.start}
                  />
                );
              })}
            </div>
          </HomeSection>
          {home.proposed.length === 0 ? null : (
            <HomeSection title="Proposed" count={home.proposed.length}>
              {home.proposed.map((line) => (
                <ProposalCard
                  key={line.ref}
                  line={line}
                  foldTargets={[...home.working, ...home.upNext]}
                  onStart={h.start}
                  onQueue={h.queue}
                  onTable={h.table}
                  onFold={h.fold}
                  onReject={h.reject}
                  onDrop={h.drop}
                />
              ))}
            </HomeSection>
          )}
          <FoldedSection title="Tabled" lines={home.tabled}>
            {home.tabled.map((line) => (
              <QuietRow key={line.ref} line={line} onStart={h.start} onQueue={h.queue} />
            ))}
          </FoldedSection>
          <FoldedSection title="Done lately" lines={home.doneLately}>
            {home.doneLately.map((line) => (
              <QuietRow key={line.ref} line={line} />
            ))}
          </FoldedSection>
        </>
      )}
    </div>
  );
}
