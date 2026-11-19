import { useRef, useState } from "react";
import { useClock } from "../../hooks/useClock.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useHomeFocusOnPage } from "../../hooks/useHomeFocusOnPage.ts";
import { useLineHandles } from "../../hooks/useLineHandles.tsx";
import { useHomeKeys } from "../../hooks/useHomeKeys.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { linesWaitingOnYou, linesWithNoOwner, nextAsk, runningAgents } from "../../lib/lines.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { Page } from "../ui/Page.tsx";
import { LoadingState } from "../ui/states.tsx";
import { AtSection } from "./AtSection.tsx";
import { AtUpNext } from "./AtUpNext.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { NotAnswering } from "./NotAnswering.tsx";
import { NothingNeedsYou } from "./NothingNeedsYou.tsx";
import { QuestionList } from "./QuestionList.tsx";
import { RecordAnswers } from "./RecordAnswers.tsx";
import { SpreadThin } from "./SpreadThin.tsx";
import { WaitingSections } from "./WaitingSections.tsx";
import { TaskItem } from "./TaskItem.tsx";
import { WorkingSection } from "./WorkingSection.tsx";
import { lineFocusRef } from "../../lib/focus.ts";
import { Section } from "../ui/Section.tsx";

const NO_KEYS = {};

/** On a phone, lines past the second fold to one row each. */
const PHONE_OPEN_LINES = 2;

/** Every line, in the developer's order, with what each needs from them in place. */
export function HomePage() {
  const h = useHome();
  const { params } = useRoute();
  // A tapped notification opens its item focused; a count in the bar, the next item it counts.
  const asked = params.get("focus");
  const narrow = useNarrow();
  const home = h.home.data;
  const page = useRef<HTMLDivElement>(null);
  const focusState = useHomeFocusOnPage(page, home, asked, h.held, params.get("next"));
  const { focus, choose, skip } = focusState;
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
      inspecting,
    }),
  );
  const { handle, drop } = useLineHandles(h);
  const at = home?.at ?? null;
  // Nothing placed yet: the proposals are all there is, grouped, with no empty sections above them.
  const firstRun =
    home !== undefined &&
    home.working.length === 0 &&
    home.upNext.length === 0 &&
    home.tabled.length === 0 &&
    home.doneLately.length === 0;
  // I'm at counts down in hours, so a minute's tick keeps it right without redrawing home every second.
  const now = useClock(at !== null, 60_000);

  return (
    <Page title="Lines" hideTitle ref={page}>
      {recording ? <RecordAnswers onClose={() => setRecording(false)} /> : null}
      {h.home.isPending && h.home.error === null ? (
        <Section title="Working on">
          <LoadingState label="Loading your lines" />
        </Section>
      ) : null}
      {/* Once loaded, a refresh that fails is the bar's Not live strip; before, the page says why it is empty. */}
      {h.home.error === null || home !== undefined ? null : (
        <NotAnswering host={window.location.host} onRetry={() => void h.home.refetch()} />
      )}
      {home === undefined ? null : (
        <>
          {at === null ? null : <AtSection at={at} now={now} onLeave={() => h.at(null)} busy={h.atBusy} />}
          {firstRun ? (
            <FirstRun
              proposals={home.proposed}
              onAccept={h.acceptRecommended}
              onNewLine={() => setParams({ new: "1" })}
            />
          ) : Object.values(home.counts).every((count) => count === 0) ? (
            <NothingNeedsYou working={runningAgents(home)} next={nextAsk(home)} />
          ) : null}
          <QuestionList
            onBringBack={h.bringBack}
            title="Urgent"
            lineOn={(ref) => {
              const placed = [...home.working, ...home.upNext];
              const at = placed.findIndex((line) => line.ref === ref);
              const line = placed[at];
              return line === undefined ? undefined : { number: at + 1, title: line.title };
            }}
            cards={home.urgent}
            focus={focus}
            inspecting={inspecting}
            armed={armed}
            onOpen={choose}
            onPostponed={skip}
          />
          {firstRun ? null : (
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
                  noOwner={linesWithNoOwner(home)}
                  waiting={linesWaitingOnYou(home)}
                  onNoOwner={() => {
                    const first = home.working.find(
                      (line) => home.crews[line.ref]?.owner == null && line.ownedBy === null,
                    );
                    if (first !== undefined) choose(lineFocusRef(first.ref));
                  }}
                  onWaiting={() => {
                    const first = home.working.find((line) => home.lines[line.ref]?.waitingOnYou === true);
                    if (first !== undefined) choose(lineFocusRef(first.ref));
                  }}
                />
              }
              onFocus={choose}
              onPostponed={skip}
            />
          )}
          {at === null ? null : (
            <AtUpNext
              tasks={at.tasks.filter((task) => home.upNext.some((line) => line.ref === task.line))}
              lines={home.upNext}
              firstNumber={home.working.length + 1}
              focus={focus}
              task={(task) => <TaskItem task={task} onDone={h.taskDone} onCant={h.taskCant} />}
            />
          )}
          <WaitingSections
            sheetArmed={params.get("ref") === null}
            firstRun={firstRun}
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
          <QuestionList
            onBringBack={h.bringBack}
            title="On no line"
            folded={narrow}
            cards={home.noLine}
            focus={focus}
            inspecting={inspecting}
            armed={armed}
            onOpen={choose}
            onPostponed={skip}
          />
        </>
      )}
    </Page>
  );
}
