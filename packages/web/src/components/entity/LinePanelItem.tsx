import type { Drift, Line } from "@octotrack/core/schemas";
import { useBackTo } from "../../hooks/useBackTo.ts";
import { useLineView } from "../../hooks/useLineView.ts";
import { useRoute } from "../../lib/router.ts";
import { failureText } from "../../lib/failure.ts";
import { ownerSentence } from "../../lib/lines.ts";
import { currentStep } from "@octotrack/core/schemas";
import { LinePrs } from "../lines/LinePrs.tsx";
import { Loaded, StaleNote } from "../ui/Loaded.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";
import { LinePanelHead } from "./LinePanelHead.tsx";
import { LineSince } from "./LineSince.tsx";
import { homeStatus } from "./homeStatus.tsx";
import { LineTell } from "./LineTell.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { PanelForYou } from "./PanelForYou.tsx";

/**
 * A line opened in a peek, the line in short (triage/T-Peek-Line): its head with who is on it and what finishes it,
 * what else is for you there, its pull requests, what changed, and Tell at its foot. Its plan, its owner's box and its
 * moves are on its own page, one press away.
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
  const { h, shown, unmarked } = view;
  // Opened from another peek: Back returns there.
  const back = useBackTo();
  const path = (shown.data?.steps ?? []).filter((step) => step.branch === null);
  const now = currentStep(path);
  return (
    <LinePanelHead
      line={line}
      repos={line.repos.map(h.repoName)}
      held={view.held}
      back={back}
      branchOf={shown.data?.branchOf ?? null}
      status={ownerSentence(
        line,
        view.crew,
        view.details?.stepIn === true,
        now === undefined ? null : { address: now.address, title: now.title },
      )}
      foot={<LineTell view={view} />}
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
        status={homeStatus(view, "what needs you")}
        except={params.get("item")}
      />
      <Loaded
        loaded={shown.data !== undefined}
        error={shown.error}
        what="its pull requests"
        onRetry={() => void shown.refetch()}
        at={shown.dataUpdatedAt}
      >
        {shown.data === undefined || shown.data.prs.length === 0 ? null : (
          <Section title="Pull requests" count={shown.data.prs.length}>
            <LinePrs prs={shown.data.prs} />
          </Section>
        )}
      </Loaded>
      <OpenDrift drift={drift} />
      <LineSince view={view} />
    </LinePanelHead>
  );
}
