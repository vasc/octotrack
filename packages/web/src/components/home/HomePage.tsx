import { useState } from "react";
import { useHome } from "../../hooks/useHome.ts";
import { useHomeFocus } from "../../hooks/useHomeFocus.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { usePush } from "../../hooks/usePush.ts";
import { firstOf } from "../../lib/focus.ts";
import { useRoute } from "../../lib/router.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { AddLineForm } from "../lines/AddLineForm.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { AtPicker } from "./AtPicker.tsx";
import { AtSection } from "./AtSection.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { HomeCounts } from "./HomeCounts.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { PushToggle } from "./PushToggle.tsx";
import { ReorderButtons } from "./ReorderButtons.tsx";
import { SpreadThin } from "./SpreadThin.tsx";
import { WaitingSections } from "./WaitingSections.tsx";
import { WorkingSection } from "./WorkingSection.tsx";

/** On a phone, lines past the second fold to one row each. */
const PHONE_OPEN_LINES = 2;

/** Every line, in the developer's order, with what each needs from them in place. */
export function HomePage() {
  const h = useHome();
  const push = usePush();
  const { params } = useRoute();
  // A tapped notification opens its question focused.
  const asked = params.get("focus");
  const narrow = useNarrow();
  const home = h.home.data;
  const { focus, armed, choose, keys } = useHomeFocus(home, asked, h.held);
  const [reordering, setReordering] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  useHotkeys(keys);
  const reorder = (title: string, ref: string, index: number, count: number) =>
    reordering ? (
      <ReorderButtons
        title={title}
        canMoveUp={index > 0}
        canMoveDown={index < count - 1}
        onMove={(direction) => h.reorder(ref, direction)}
      />
    ) : null;
  const at = home?.at ?? null;

  return (
    <div className="page">
      <PageHead title="Lines">
        <AtPicker places={h.places} at={at?.place ?? null} onAt={h.at} />
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
      {home === undefined ? null : (
        <>
          <HomeCounts
            counts={home.counts}
            onPick={(count) => {
              const first = firstOf(home, count);
              if (first !== null) choose(first);
            }}
          />
          <SpreadThin
            working={home.working.length}
            noOwner={
              home.working.filter((line) => home.crews[line.ref]?.owner == null && line.ownedBy === null)
                .length
            }
            waiting={home.working.filter((line) => (home.lines[line.ref]?.forYou.length ?? 0) > 0).length}
          />
        </>
      )}
      <AddLineForm repos={h.repos} onAdd={h.add} />
      {h.failure === null ? null : <ErrorState error={h.failure} />}
      {h.home.isPending ? <LoadingState /> : null}
      {h.home.error === null ? null : <ErrorState error={h.home.error} />}
      {home === undefined ? null : (
        <>
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
                  active={card.decision.ref === focus}
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
            onFocus={choose}
          />
          <WaitingSections
            home={home}
            h={h}
            focus={focus}
            starting={starting}
            reorder={reorder}
            onStarting={setStarting}
          />
        </>
      )}
    </div>
  );
}
