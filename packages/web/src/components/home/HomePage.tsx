import type { ForYou, HomeView } from "@octotrack/core/schemas";
import { useMemo, useState } from "react";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useHome } from "../../hooks/useHome.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { AddLineForm } from "../lines/AddLineForm.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { FoldedSection } from "./FoldedSection.tsx";
import { ForYouItem, refOf } from "./ForYouItem.tsx";
import { HomeCounts } from "./HomeCounts.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { ProposalCard } from "./ProposalCard.tsx";
import { QuietRow } from "./QuietRow.tsx";
import { ReorderButtons } from "./ReorderButtons.tsx";
import { StepIn } from "./StepIn.tsx";
import { UpNextRow } from "./UpNextRow.tsx";
import { WorkingLine } from "./WorkingLine.tsx";

/** What has focus when nothing was chosen, or the choice is gone: an urgent question, else the first thing waiting. */
function defaultFocus(home: HomeView): string | null {
  const urgent = home.urgent[0];
  if (urgent !== undefined) return urgent.decision.ref;
  for (const line of home.working) {
    const first = home.lines[line.ref]?.forYou[0];
    if (first !== undefined) return refOf(first);
  }
  return null;
}

/** Everything waiting on the developer, in the order j and k walk through it: urgent first, then line by line. */
function orderedRefs(home: HomeView): string[] {
  return [
    ...home.urgent.map((card) => card.decision.ref),
    ...home.working.flatMap((line) => (home.lines[line.ref]?.forYou ?? []).map(refOf)),
  ];
}

/** Every line, in the developer's order, with what each needs from them in place. */
export function HomePage() {
  const h = useHome();
  const home = h.home.data;
  const [chosen, setChosen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [reordering, setReordering] = useState(false);
  const order = useMemo(() => (home === undefined ? [] : orderedRefs(home)), [home]);
  const focus =
    home === undefined ? null : chosen !== null && order.includes(chosen) ? chosen : defaultFocus(home);
  const keys = useMemo((): HotkeyMap => {
    const at = focus === null ? -1 : order.indexOf(focus);
    const step = (by: number) => () => {
      const next = order[Math.min(Math.max(at + by, 0), order.length - 1)];
      if (next !== undefined) setChosen(next);
    };
    return order.length === 0 ? {} : { j: step(1), k: step(-1) };
  }, [focus, order]);
  useHotkeys(keys);

  const item = (forYou: ForYou) => (
    <ForYouItem
      key={refOf(forYou)}
      item={forYou}
      focused={refOf(forYou) === focus}
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
      <AddLineForm onAdd={h.add} />
      {h.failure === null ? null : <ErrorState error={h.failure} />}
      {h.home.isPending ? <LoadingState /> : null}
      {h.home.error === null ? null : <ErrorState error={h.home.error} />}
      {home === undefined ? null : (
        <>
          {home.urgent.length === 0 ? null : (
            <HomeSection title="Urgent" count={home.urgent.length}>
              {home.urgent.map((card) => (
                <DecisionCardItem key={card.decision.ref} card={card} active={card.decision.ref === focus} />
              ))}
            </HomeSection>
          )}
          <HomeSection title="Working on" count={home.working.length} note="your order is everyone's order">
            {home.working.length === 0 ? <p className="muted">Nothing is being worked on.</p> : null}
            {home.working.map((line, index) => {
              const details = home.lines[line.ref];
              const crew = home.crews[line.ref];
              const [first, ...rest] = details?.forYou ?? [];
              const open = expanded.has(line.ref) || rest.some((other) => refOf(other) === focus);
              return (
                <WorkingLine
                  key={line.ref}
                  index={index + 1}
                  line={line}
                  {...(crew === undefined ? {} : { crew })}
                  {...(details === undefined ? {} : { details })}
                  reorder={reorder(line.title, line.ref, index, home.working.length)}
                >
                  {crew?.search?.step === 3 ? <StepIn line={line} onOwn={h.own} onTable={h.table} /> : null}
                  {first === undefined ? null : <div className="home-items">{item(first)}</div>}
                  {rest.length === 0 ? null : open ? (
                    <div className="home-items">{rest.map(item)}</div>
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
