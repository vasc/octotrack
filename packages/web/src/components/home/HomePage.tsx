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
import { NewLineCard } from "../lines/NewLineCard.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { AtSection } from "./AtSection.tsx";
import { AtUpNext } from "./AtUpNext.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { NothingNeedsYou } from "./NothingNeedsYou.tsx";
import { QuestionList } from "./QuestionList.tsx";
import { RecordAnswers } from "./RecordAnswers.tsx";
import { SpreadThin } from "./SpreadThin.tsx";
import { WaitingSections } from "./WaitingSections.tsx";
import { TaskItem } from "./TaskItem.tsx";
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
  const page = useRef<HTMLDivElement>(null);
  const focusState = useHomeFocusOnPage(page, home, asked, h.held);
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
  // I'm at counts down in hours, so a minute's tick keeps it right without redrawing home every second.
  const now = useClock(at !== null, 60_000);

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
      {recording ? <RecordAnswers onClose={() => setRecording(false)} /> : null}
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
          <QuestionList
            title="Urgent"
            cards={home.urgent}
            focus={focus}
            inspecting={inspecting}
            armed={armed}
            onOpen={choose}
            onPostponed={skip}
          />
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
              task={(task) => <TaskItem task={task} onDone={h.taskDone} onCant={h.taskCant} />}
            />
          )}
          <WaitingSections
            sheetArmed={params.get("ref") === null}
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
            title="On no line"
            note="from before lines; their agents should put each on its line"
            cards={home.noLine}
            focus={focus}
            inspecting={inspecting}
            armed={armed}
            onOpen={choose}
            onPostponed={skip}
          />
        </>
      )}
    </div>
  );
}
