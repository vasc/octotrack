import { useMemo, useState } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { useClearedToday } from "../../hooks/useClearedToday.ts";
import { useForYou } from "../../hooks/useForYou.ts";
import { useForYouKeys } from "../../hooks/useForYouKeys.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { FILTERS, type Filter, forYouPath, nextFilter } from "../../lib/forYou.ts";
import { nextAsk, workingOn } from "../../lib/lines.ts";
import { navigate, peekEntity, useRoute } from "../../lib/router.ts";
import { RecordAnswers } from "../home/RecordAnswers.tsx";
import { StartSheet } from "../home/StartSheet.tsx";
import { NotAnswering } from "../home/NotAnswering.tsx";
import { LoadingState } from "../ui/states.tsx";
import { Queue } from "../ui/Queue.tsx";
import { Triage } from "../ui/Triage.tsx";
import { ForYouCard } from "./ForYouCard.tsx";
import { ForYouEmpty } from "./ForYouEmpty.tsx";
import { ForYouEntry } from "./ForYouEntry.tsx";
import { ForYouListRow } from "./ForYouListRow.tsx";
import { ForYouRail } from "./ForYouRail.tsx";

const NO_COUNTS: Readonly<Record<Filter, number>> = {
  all: 0,
  urgent: 0,
  toAnswer: 0,
  toDo: 0,
  toAccept: 0,
  toStepIn: 0,
};

/**
 * For you: everything that waits on the developer, as one list beside the rail of views, the entry they are on opened
 * in place with its moves and the rest one row each. A line named on the card peeks in place, and the page folds its
 * rail so the list and the peek are both whole.
 */
export function ForYouPage({ filter }: { filter: Filter }) {
  const h = useHome();
  const { params } = useRoute();
  const home = h.home.data;
  const { pending } = useChoices();
  const view = useForYou(home, filter, params.get("item") ?? params.get("focus"), pending);
  const peek = params.get("ref");
  const [starting, setStarting] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  // A peek or a sheet takes the keys, and the page stands down, so one key never acts twice.
  const inspecting = peek !== null || starting !== null || recording;
  const open = view.open;
  const armed = open !== null && !h.held.has(open.ref) && !inspecting;
  useHotkeys(
    useForYouKeys({
      open,
      armed,
      inspecting,
      step: view.step,
      onRecord: () => setRecording(true),
      urgent: (view.counts?.urgent ?? 0) > 0 ? () => navigate(forYouPath("urgent")) : null,
    }),
  );
  const counts = view.counts ?? NO_COUNTS;
  const name = FILTERS.find((entry) => entry.key === filter)?.label ?? "All";
  const step = useMemo(() => {
    if (home === undefined || open?.line == null) return null;
    const at = home.lines[open.line.ref]?.step;
    return at == null ? null : `step ${at.position} of ${at.of}, ${at.title}`;
  }, [home, open]);
  const startingLine = home?.proposed.find((line) => line.ref === starting);
  const then = nextFilter(counts, filter);
  // Asked only once everything is clear, when it is said.
  const cleared = useClearedToday(open === null && filter === "all");
  return (
    <>
      {recording ? <RecordAnswers onClose={() => setRecording(false)} /> : null}
      <Triage folded={peek !== null} rail={<ForYouRail counts={counts} filter={filter} />}>
        {home === undefined ? (
          h.home.error === null ? (
            <LoadingState label="Loading what waits on you" />
          ) : (
            <NotAnswering host={window.location.host} onRetry={() => void h.home.refetch()} />
          )
        ) : open === null ? (
          <ForYouEmpty
            filter={filter}
            working={workingOn(home)}
            cleared={cleared}
            nextAsk={nextAsk(home)}
            then={
              then === null
                ? null
                : {
                    filter: then,
                    label: FILTERS.find((entry) => entry.key === then)?.label ?? "",
                    count: counts[then],
                  }
            }
          />
        ) : (
          <Queue title={name} subtitle={`${view.index + 1} of ${view.entries.length} open`}>
            {view.entries.map((entry, index) =>
              entry === open ? (
                <ForYouCard
                  key={entry.ref}
                  entry={entry}
                  step={step}
                  peeking={entry.line !== null && peek === entry.line.ref}
                  onPeek={(line) => peekEntity(line)}
                >
                  <ForYouEntry
                    entry={entry}
                    home={home}
                    h={h}
                    armed={armed}
                    onMoveOn={view.moveOn}
                    onStarting={setStarting}
                  />
                </ForYouCard>
              ) : (
                <ForYouListRow
                  key={entry.ref}
                  entry={entry}
                  number={index + 1}
                  busy={h.held.has(entry.ref)}
                  onOpen={view.go}
                  onMove={(ref, move) => (move === "start" ? h.start(ref) : h.queue(ref))}
                />
              ),
            )}
          </Queue>
        )}
      </Triage>
      {startingLine === undefined ? null : (
        <StartSheet
          line={startingLine}
          onDoneWhen={h.doneWhen}
          onStart={(started) => {
            h.start(started);
            setStarting(null);
          }}
          onCancel={() => setStarting(null)}
          armed={peek === null}
        />
      )}
    </>
  );
}
