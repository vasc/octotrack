import { useRef, useState } from "react";
import { useBrowserFocus } from "../../hooks/useBrowserFocus.ts";
import { useClock } from "../../hooks/useClock.ts";
import { useDragOrder } from "../../hooks/useDragOrder.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useHomeFocus } from "../../hooks/useHomeFocus.ts";
import { useHomeKeys } from "../../hooks/useHomeKeys.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { nextAsk, runningAgents } from "../../lib/lines.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { BatchPanel } from "../decisions/BatchPanel.tsx";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { NewLineCard } from "../lines/NewLineCard.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { AtSection } from "./AtSection.tsx";
import { AtUpNext } from "./AtUpNext.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { FocusTarget } from "./FocusTarget.tsx";
import { NothingNeedsYou } from "./NothingNeedsYou.tsx";
import { ForYouRow } from "./ForYouRow.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { LineHandle } from "./LineHandle.tsx";
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
  const { focus, choose, follow, skip } = focusState;
  const page = useRef<HTMLDivElement>(null);
  useBrowserFocus(page, focus, focusState.moved, follow);
  const [starting, setStarting] = useState<string | null>(null);
  // With a ref open in the panel, or a Start sheet open, that takes the keys and home stands down, so one key never
  // answers twice.
  const inspecting = params.get("ref") !== null || starting !== null;
  const armed = focusState.armed && !inspecting;
  const keys = inspecting ? NO_KEYS : focusState.keys;
  const [recording, setRecording] = useState(false);
  useHotkeys(keys);
  useHotkeys(
    useHomeKeys({
      page,
      home,
      focus: inspecting ? null : focus,
      armed,
      choose,
      move: h.reorder,
      onRecord: () => setRecording(true),
    }),
  );
  const dragFor = useDragOrder(h.dropBefore);
  const drop = (ref: string, section: "working" | "up_next") => dragFor(ref, section).target;
  // Each line's handle is the one way to reorder: drag it, or open it for its moves.
  const handle = (
    title: string,
    ref: string,
    index: number,
    count: number,
    section: "working" | "up_next",
  ) => (
    <LineHandle
      title={title}
      canMoveUp={index > 0}
      canMoveDown={index < count - 1}
      canQueue={section === "working"}
      drag={dragFor(ref, section).handle}
      onMove={(direction) => h.reorder(ref, direction)}
    />
  );
  const at = home?.at ?? null;
  const now = useClock(false);

  return (
    <div className="page" ref={page}>
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
          {home.working.length === 0 && home.upNext.length === 0 ? (
            <FirstRun proposals={home.proposed} repos={h.repos.length} onAccept={h.acceptRecommended} />
          ) : Object.values(home.counts).every((count) => count === 0) ? (
            <NothingNeedsYou working={runningAgents(home)} next={nextAsk(home)} />
          ) : null}
          {at === null ? null : <AtSection at={at} now={now} onLeave={() => h.at(null)} />}
          {home.urgent.length === 0 ? null : (
            <HomeSection title="Urgent" count={home.urgent.length}>
              {home.urgent.map((card) => (
                <FocusTarget
                  key={card.decision.ref}
                  focusRef={card.decision.ref}
                  focused={card.decision.ref === focus}
                >
                  {/* Opened only with focus, like any question, so a key meant for another never answers it. */}
                  {card.decision.ref === focus ? (
                    <DecisionCardItem card={card} active={!inspecting} armed={armed} onPostponed={skip} />
                  ) : (
                    <ForYouRow item={{ kind: "question", card }} onOpen={choose} />
                  )}
                </FocusTarget>
              ))}
            </HomeSection>
          )}
          <WorkingSection
            home={home}
            h={h}
            focus={focus}
            armed={armed}
            // On a phone, lines past the second fold to one row each; at a place, everything but its tasks does.
            foldFrom={narrow ? PHONE_OPEN_LINES : Number.POSITIVE_INFINITY}
            at={at?.place ?? null}
            handle={handle}
            drop={drop}
            actions={
              <SpreadThin
                working={home.working.length}
                noOwner={
                  home.working.filter((line) => home.crews[line.ref]?.owner == null && line.ownedBy === null)
                    .length
                }
                waiting={home.working.filter((line) => home.lines[line.ref]?.waitingOnYou === true).length}
              />
            }
            onFocus={choose}
            onPostponed={skip}
          />
          {at === null ? null : (
            <AtUpNext
              tasks={at.tasks.filter((task) => home.upNext.some((line) => line.ref === task.line))}
              lines={home.upNext}
              firstNumber={home.working.length + 1}
              focus={focus}
              onTaskDone={h.taskDone}
              onTaskCant={h.taskCant}
            />
          )}
          <WaitingSections
            home={home}
            h={h}
            focus={focus}
            starting={starting}
            // At a place everything else folds, up next and proposals included; urgent questions never do.
            narrow={narrow || at !== null}
            handle={handle}
            drop={drop}
            onStarting={setStarting}
          />
          {home.noLine.length === 0 ? null : (
            <HomeSection
              title="On no line"
              count={home.noLine.length}
              note="from before lines; their agents should put each on its line"
            >
              <div className="line-items" data-flush="true">
                {home.noLine.map((card) => (
                  <FocusTarget
                    key={card.decision.ref}
                    focusRef={card.decision.ref}
                    focused={card.decision.ref === focus}
                  >
                    {card.decision.ref === focus ? (
                      <DecisionCardItem card={card} active={!inspecting} armed={armed} onPostponed={skip} />
                    ) : (
                      <ForYouRow item={{ kind: "question", card }} onOpen={choose} />
                    )}
                  </FocusTarget>
                ))}
              </div>
            </HomeSection>
          )}
        </>
      )}
    </div>
  );
}
