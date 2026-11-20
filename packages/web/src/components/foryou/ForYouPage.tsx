import { useMemo, useState } from "react";
import { useForYou } from "../../hooks/useForYou.ts";
import { useForYouKeys } from "../../hooks/useForYouKeys.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { FILTERS, type Filter, forYouPath, nextFilter } from "../../lib/forYou.ts";
import { nextAsk, runningAgents } from "../../lib/lines.ts";
import { navigate, openEntity, useRoute } from "../../lib/router.ts";
import { RecordAnswers } from "../home/RecordAnswers.tsx";
import { StartSheet } from "../home/StartSheet.tsx";
import { NotAnswering } from "../home/NotAnswering.tsx";
import { LoadingState } from "../ui/states.tsx";
import { Triage } from "../ui/Triage.tsx";
import { ForYouCard } from "./ForYouCard.tsx";
import { ForYouEmpty } from "./ForYouEmpty.tsx";
import { ForYouEntry } from "./ForYouEntry.tsx";
import { ForYouNext } from "./ForYouNext.tsx";
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
 * For you: what waits on the developer, one at a time. The rail picks a view; the one entry open sits in the middle
 * with its moves; what comes next waits beside it. A line named on the card peeks in place, and the page folds its
 * rail and Next so the card and the peek are both whole.
 */
export function ForYouPage({ filter }: { filter: Filter }) {
  const h = useHome();
  const { params } = useRoute();
  const home = h.home.data;
  const view = useForYou(home, filter, params.get("item") ?? params.get("focus"));
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
  return (
    <>
      {recording ? <RecordAnswers onClose={() => setRecording(false)} /> : null}
      <Triage
        folded={peek !== null}
        rail={<ForYouRail counts={counts} filter={filter} />}
        next={
          open === null || view.counts === null ? null : (
            <ForYouNext
              entries={view.entries}
              index={view.index}
              filter={filter}
              counts={view.counts}
              onOpen={view.go}
            />
          )
        }
      >
        {home === undefined ? (
          h.home.error === null ? (
            <LoadingState label="Loading what waits on you" />
          ) : (
            <NotAnswering host={window.location.host} onRetry={() => void h.home.refetch()} />
          )
        ) : open === null ? (
          <ForYouEmpty
            filter={filter}
            working={runningAgents(home)}
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
          <ForYouCard
            key={open.ref}
            entry={open}
            view={name}
            at={view.index + 1}
            of={view.entries.length}
            urgent={filter === "urgent"}
            step={step}
            peeking={open.line !== null && peek === open.line.ref}
            onPeek={(line) => openEntity(line)}
          >
            <ForYouEntry
              entry={open}
              home={home}
              h={h}
              armed={armed}
              onPutOff={view.putOff}
              onStarting={setStarting}
            />
          </ForYouCard>
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
