import { contracts } from "@octotrack/core/contracts";
import type { Drift, HomeView, Line } from "@octotrack/core/schemas";
import { ApiError } from "../../api/client.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useLineView } from "../../hooks/useLineView.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { navigate } from "../../lib/router.ts";
import { LineFacts } from "../entity/LineFacts.tsx";
import { LineMoves } from "../entity/LineMoves.tsx";
import { LinePlan } from "../entity/LinePlan.tsx";
import { LineSince } from "../entity/LineSince.tsx";
import { LineStanding } from "../entity/LineStanding.tsx";
import { LineTell } from "../entity/LineTell.tsx";
import { OpenDrift } from "../entity/OpenDrift.tsx";
import { OwnerBox } from "../entity/OwnerBox.tsx";
import { notFoundTitle, RefNotFound } from "../entity/RefNotFound.tsx";
import { SummaryBox } from "../entity/SummaryBox.tsx";
import { DetailPage } from "../ui/DetailPage.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Page } from "../ui/Page.tsx";
import { Section } from "../ui/Section.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { LineForYouHere } from "./LineForYouHere.tsx";
import { LinePrs } from "./LinePrs.tsx";

/** Where a line sits among the developer's lines, for its crumbs: "Working on, 1". */
function placeOf(line: Line, home: HomeView | undefined): string {
  const label = LINE_STATE_LABEL[line.state];
  const section =
    line.state === "working" ? home?.working : line.state === "up_next" ? home?.upNext : undefined;
  const at = section?.findIndex((other) => other.ref === line.ref) ?? -1;
  return at === -1 ? label : `${label}, ${at + 1}`;
}

/** A line on a page of its own, at /lines/L-1: loaded by its ref, or said not to exist. */
export function LinePage({ lineRef }: { lineRef: string }) {
  const detail = useOpQuery(contracts.entityShow, { ref: lineRef });
  const h = useHome();
  const entity = detail.data?.entity;
  if (entity !== undefined && "doneWhen" in entity)
    return <LineWhole line={entity} drift={detail.data?.drift ?? []} />;
  const known = h.lineOf(lineRef);
  if (known !== null && detail.error === null) return <LineWhole line={known} drift={[]} />;
  if ((detail.error instanceof ApiError && detail.error.code === "not_found") || entity !== undefined)
    return (
      <Page title={notFoundTitle(lineRef)}>
        <RefNotFound refName={lineRef} />
      </Page>
    );
  return (
    <Page title={lineRef}>
      {detail.error === null ? (
        <LoadingState label={`Loading ${lineRef}`} />
      ) : (
        <ErrorState
          title={`Could not load ${lineRef}.`}
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
      )}
    </Page>
  );
}

/** The line whole: its standing and moves at the top, its plan and what goes with it, and beside it what is for you. */
function LineWhole({ line, drift }: { line: Line; drift: readonly Drift[] }) {
  const view = useLineView(line);
  const { h, home, shown } = view;
  return (
    <DetailPage
      onGo={navigate}
      crumbs={[{ label: "Lines", href: "/lines" }, { label: placeOf(line, home) }]}
      title={line.title}
      lead={line.headline === null ? undefined : <Markdown text={line.headline} inline />}
      facts={<LineFacts line={line} repos={line.repos.map(h.repoName)} />}
      actions={<LineMoves view={view} />}
      aside={
        <>
          {home === undefined ? null : <LineForYouHere home={home} line={line.ref} />}
          <SummaryBox line={line} />
          <LineSince view={view} />
        </>
      }
    >
      <LineStanding line={line} held={view.held} branchOf={shown.data?.branchOf ?? null} />
      <OpenDrift drift={drift} />
      <LinePlan view={view} />
      {shown.data === undefined || shown.data.prs.length === 0 ? null : (
        <Section title="Pull requests" count={shown.data.prs.length}>
          <LinePrs prs={shown.data.prs} />
        </Section>
      )}
      <OwnerBox
        line={line}
        crew={view.crew}
        repoNames={line.repos.map(h.repoName)}
        onStop={view.choices.stop}
        onOwn={() => view.choices.choose("own")}
        waitingOnYou={view.details?.waitingOnYou === true}
        ownInHead={view.stepIn !== null}
      />
      <LineTell view={view} />
    </DetailPage>
  );
}
