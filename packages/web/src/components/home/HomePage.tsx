import { useState } from "react";
import { useHome } from "../../hooks/useHome.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLineHandles } from "../../hooks/useLineHandles.tsx";
import { useLinesKeys } from "../../hooks/useLinesKeys.ts";
import { useNarrow } from "../../hooks/useNarrow.ts";
import { linesWaitingOnYou, linesWithNoOwner } from "../../lib/lines.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { Page } from "../ui/Page.tsx";
import { Section } from "../ui/Section.tsx";
import { LoadingState } from "../ui/states.tsx";
import { FirstRun } from "./FirstRun.tsx";
import { NotAnswering } from "./NotAnswering.tsx";
import { SpreadThin } from "./SpreadThin.tsx";
import { WaitingSections } from "./WaitingSections.tsx";
import { WorkingSection } from "./WorkingSection.tsx";

/**
 * Lines: every line in the developer's order, section by section, each one row saying how it stands and how much waits
 * on them there, which leads to For you. A line opens on its own page; its number drags it or opens its moves.
 */
export function HomePage() {
  const h = useHome();
  const { params } = useRoute();
  const narrow = useNarrow();
  const home = h.home.data;
  const [starting, setStarting] = useState<string | null>(null);
  // With a ref open in a peek, or a Start sheet open, that takes the keys and Lines stands down.
  const inspecting = params.get("ref") !== null || starting !== null;
  const { keys, focus } = useLinesKeys({ home, inspecting, move: h.reorder });
  useHotkeys(keys);
  const { handle, drop } = useLineHandles(h);
  // Nothing placed yet: the proposals are all there is, grouped, with no empty sections above them.
  const firstRun =
    home !== undefined &&
    home.working.length === 0 &&
    home.upNext.length === 0 &&
    home.tabled.length === 0 &&
    home.doneLately.length === 0;
  const subtitle =
    home === undefined
      ? undefined
      : [
          `${home.working.length} working on`,
          `${home.upNext.length} up next`,
          `${home.proposed.length} proposed`,
          `${home.tabled.length} tabled`,
        ].join(" · ");
  return (
    <Page title="Lines" {...(subtitle === undefined ? {} : { subtitle })}>
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
          {firstRun ? (
            <FirstRun
              proposals={home.proposed}
              onAccept={h.acceptRecommended}
              onNewLine={() => setParams({ new: "1" })}
            />
          ) : (
            <WorkingSection
              home={home}
              h={h}
              focus={focus}
              handle={handle}
              drop={drop}
              actions={
                <SpreadThin
                  working={home.working.length}
                  noOwner={linesWithNoOwner(home)}
                  waiting={linesWaitingOnYou(home)}
                />
              }
            />
          )}
          <WaitingSections
            sheetArmed={params.get("ref") === null}
            firstRun={firstRun}
            home={home}
            h={h}
            focus={focus}
            starting={starting}
            narrow={narrow}
            handle={handle}
            drop={drop}
            onStarting={setStarting}
          />
        </>
      )}
    </Page>
  );
}
