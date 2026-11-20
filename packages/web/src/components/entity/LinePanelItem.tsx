import type { Drift, Line } from "@octotrack/core/schemas";
import { useBackTo } from "../../hooks/useBackTo.ts";
import { useLineView } from "../../hooks/useLineView.ts";
import { useRoute } from "../../lib/router.ts";
import { failureText } from "../../lib/failure.ts";
import { LinePrs } from "../lines/LinePrs.tsx";
import { Loaded, StaleNote } from "../ui/Loaded.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";
import { LineMoves } from "./LineMoves.tsx";
import { LinePanelHead } from "./LinePanelHead.tsx";
import { LinePlan } from "./LinePlan.tsx";
import { LineSince } from "./LineSince.tsx";
import { LineTell } from "./LineTell.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { OwnerBox } from "./OwnerBox.tsx";
import { PanelForYou } from "./PanelForYou.tsx";
import { SummaryBox } from "./SummaryBox.tsx";

/**
 * A line opened in a peek, in one column read top to bottom: where it stands and how to move it, what it needs from
 * you, its summary, its plan, what happened, who owns it, then Tell. Its own page shows the same, laid out wide.
 */
export function LinePanelItem({
  line,
  drift,
  stale = null,
  staleAt,
  onRetry,
}: {
  line: Line;
  drift: readonly Drift[];
  /** Why the panel could not refresh, once it had loaded: what it shows may be out of date. */
  stale?: Error | null;
  /** When what is shown was last loaded, for a stale panel to say. */
  staleAt?: number;
  /** Loads it again, after a refresh that failed. */
  onRetry?: () => void;
}) {
  const view = useLineView(line);
  // Peeked at from For you: the item open there.
  const { params } = useRoute();
  const { h, home, shown, unmarked } = view;
  // Opened from another peek: Back returns there.
  const back = useBackTo();
  // Until Lines has loaded once, who owns the line and what it needs from the developer are not known: say so.
  const homeStatus = (what: string) =>
    home === undefined ? (
      <Loaded loaded={false} error={h.home.error} what={what} onRetry={() => void h.home.refetch()}>
        {null}
      </Loaded>
    ) : undefined;
  return (
    <LinePanelHead
      line={line}
      repos={line.repos.map(h.repoName)}
      held={view.held}
      back={back}
      branchOf={shown.data?.branchOf ?? null}
      actions={<LineMoves view={view} />}
    >
      {stale === null ? null : <StaleNote at={staleAt} what={line.ref} onRetry={onRetry} />}
      {unmarked === null ? null : (
        <Note error hint={failureText(unmarked).hint}>
          Could not mark {line.ref} seen. {failureText(unmarked).text}
        </Note>
      )}
      <PanelForYou
        title={line.title}
        items={view.forYou}
        h={h}
        status={homeStatus("what needs you")}
        except={params.get("item")}
      />
      {/* Loading and failing show once, with the plan, which comes in the same answer. */}
      {shown.data === undefined || shown.data.prs.length === 0 ? null : (
        <Section title="Pull requests" count={shown.data.prs.length}>
          <LinePrs prs={shown.data.prs} />
        </Section>
      )}
      <SummaryBox line={line} />
      <OpenDrift drift={drift} />
      <LinePlan view={view} />
      <LineSince view={view} />
      <OwnerBox
        line={line}
        crew={view.crew}
        repoNames={line.repos.map(h.repoName)}
        onStop={view.choices.stop}
        onOwn={() => view.choices.choose("own")}
        waitingOnYou={view.details?.waitingOnYou === true}
        status={homeStatus("the owner")}
        ownInHead={view.stepIn !== null}
      />
      <LineTell view={view} />
    </LinePanelHead>
  );
}
