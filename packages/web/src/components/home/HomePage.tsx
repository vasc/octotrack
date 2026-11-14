import { useState } from "react";
import { useDragOrder } from "../../hooks/useDragOrder.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useHomeFocus } from "../../hooks/useHomeFocus.ts";
import { useHomeKeys } from "../../hooks/useHomeKeys.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { BatchPanel } from "../decisions/BatchPanel.tsx";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { NewLineCard } from "../lines/NewLineCard.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { AtSection } from "./AtSection.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { ForYouRow } from "./ForYouRow.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { ReorderButtons } from "./ReorderButtons.tsx";
import { SpreadThin } from "./SpreadThin.tsx";
import { WaitingSections } from "./WaitingSections.tsx";
import { WorkingSection } from "./WorkingSection.tsx";

const NO_KEYS = {};

/** On a phone, lines past the second fold to one row each. */
const PHONE_OPEN_LINES = 2;

/** Every line, in the developer's order, with what each needs from them in place. */
export function HomePage() {
  const h = useHome();
  const { params } = useRoute();
  // A tapped notification, or a count in the bar, opens its item focused.
  const asked = params.get("focus");
  const adding = params.get("new") === "1";
  const narrow = useNarrow();
  const home = h.home.data;
  const focusState = useHomeFocus(home, asked, h.held);
  const { focus, choose } = focusState;
  // With a ref open in the panel, the panel takes the keys and home stands down, so one key never answers twice.
  const inspecting = params.get("ref") !== null;
  const armed = focusState.armed && !inspecting;
  const keys = inspecting ? NO_KEYS : focusState.keys;
  const [reordering, setReordering] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  useHotkeys(keys);
  useHotkeys(
    useHomeKeys({
      home,
      focus: inspecting ? null : focus,
      armed,
      choose,
      move: h.reorder,
      onRecord: () => setRecording(true),
    }),
  );
  const dragFor = useDragOrder(h.dropBefore);
  const drag = (ref: string, section: string) => (reordering ? undefined : dragFor(ref, section));
  const reorder = (title: string, ref: string, index: number, count: number) =>
    reordering ? (
      <ReorderButtons
        title={title}
        canMoveUp={index > 0}
        canMoveDown={index < count - 1}
        canQueue={home?.working.some((line) => line.ref === ref) === true}
        onMove={(direction) => h.reorder(ref, direction)}
      />
    ) : null;
  const at = home?.at ?? null;

  return (
    <div className="page">
      <h1 className="visually-hidden">Lines</h1>
      {adding ? (
        <NewLineCard
          repos={h.repos}
          onAdd={(line) => {
            h.add(line);
            setParams({ new: null });
          }}
          onCancel={() => setParams({ new: null })}
        />
      ) : null}
      {recording ? (
        <section className="home-section" aria-label="Record answers">
          <BatchPanel />
          <button type="button" className="btn" onClick={() => setRecording(false)}>
            Close
          </button>
        </section>
      ) : null}
      {h.failure === null ? null : <ErrorState error={h.failure} />}
      {h.home.isPending ? <LoadingState /> : null}
      {h.home.error === null ? null : <ErrorState error={h.home.error} />}
      {home === undefined ? null : (
        <>
          <SpreadThin
            working={home.working.length}
            noOwner={
              home.working.filter((line) => home.crews[line.ref]?.owner == null && line.ownedBy === null)
                .length
            }
            waiting={home.working.filter((line) => (home.lines[line.ref]?.forYou.length ?? 0) > 0).length}
          />
          {home.working.length === 0 && home.upNext.length === 0 ? (
            <FirstRun proposals={home.proposed} onAccept={h.acceptRecommended} />
          ) : null}
          {at === null ? null : (
            <AtSection at={at} onLeave={() => h.at(null)} onTaskDone={h.taskDone} onTaskCant={h.taskCant} />
          )}
          {home.urgent.length === 0 ? null : (
            <HomeSection title="Urgent" count={home.urgent.length}>
              {home.urgent.map((card) => (
                <DecisionCardItem
                  key={card.decision.ref}
                  card={card}
                  active={card.decision.ref === focus && !inspecting}
                  armed={armed && card.decision.ref === focus}
                />
              ))}
            </HomeSection>
          )}
          <WorkingSection
            home={home}
            h={h}
            focus={focus}
            armed={armed}
            // At a place, everything else folds to one row per line; on a phone, lines past the second do.
            foldFrom={at !== null ? 0 : narrow ? PHONE_OPEN_LINES : Number.POSITIVE_INFINITY}
            reorder={reorder}
            drag={drag}
            actions={
              <button
                type="button"
                className="btn"
                aria-pressed={reordering}
                onClick={() => setReordering(!reordering)}
              >
                {reordering ? "Done reordering" : "Reorder"}
              </button>
            }
            onFocus={choose}
          />
          <WaitingSections
            home={home}
            h={h}
            focus={focus}
            starting={starting}
            narrow={narrow}
            reorder={reorder}
            drag={drag}
            onStarting={setStarting}
          />
          {home.noLine.length === 0 ? null : (
            <HomeSection
              title="On no line"
              count={home.noLine.length}
              note="from before lines; their agents should put each on its line"
            >
              <div className="line-items" data-flush="true">
                {home.noLine.map((card) =>
                  card.decision.ref === focus ? (
                    <DecisionCardItem key={card.decision.ref} card={card} active armed={armed} />
                  ) : (
                    <ForYouRow key={card.decision.ref} item={{ kind: "question", card }} onOpen={choose} />
                  ),
                )}
              </div>
            </HomeSection>
          )}
        </>
      )}
    </div>
  );
}
