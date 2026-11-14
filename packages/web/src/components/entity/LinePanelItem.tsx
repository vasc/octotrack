import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { StartSheet } from "../home/StartSheet.tsx";
import { useHome } from "../../hooks/useHome.ts";
import { useLineChoices } from "../../hooks/useLineChoices.ts";
import { useMarkSeen } from "../../hooks/useMarkSeen.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useRoute } from "../../lib/router.ts";
import { NotKept } from "../ui/NotKept.tsx";
import { ErrorState } from "../ui/states.tsx";
import { LineActions } from "./LineActions.tsx";
import { LinePanelHead } from "./LinePanelHead.tsx";
import { OwnerBox } from "./OwnerBox.tsx";
import { OwnWorkBox } from "./OwnWorkBox.tsx";
import { PanelForYou } from "./PanelForYou.tsx";
import { PlanList } from "./PlanList.tsx";
import { SinceSummary } from "./SinceSummary.tsx";
import { SummaryBox } from "./SummaryBox.tsx";
import { TellBox } from "./TellBox.tsx";

/**
 * A line opened, as E-Line draws it: where it stands and how to move it, its summary, what it needs from you, its plan
 * beside what is new and who owns it, and Tell. Opening it marks it seen.
 */
export function LinePanelItem({ line }: { line: Line }) {
  const choices = useLineChoices(line);
  const { waiting: choicesWaiting } = useChoices();
  const h = useHome();
  const shown = useOpQuery(contracts.lineShow, { ref: line.ref });
  const since = useOpQuery(contracts.feedList, { query: `line:${line.ref}`, limit: 50 });
  const tell = useDraft(`tell:${line.ref}`);
  const own = useDraft(`own:${line.ref}`);
  useMarkSeen(line.ref);
  // As it was when the panel opened: opening it marks the line seen, which must not fold what is being read now.
  const [seenAt] = useState(line.seenAt);
  const [starting, setStarting] = useState(false);
  // Opened with t from home: straight to Tell.
  const telling = useRoute().params.get("act") === "tell";
  const home = h.home.data;
  const crew = home?.crews[line.ref];
  const owner = crew?.owner?.name ?? null;
  const order = home === undefined ? [] : [...home.working, ...home.upNext];
  const at = order.findIndex((candidate) => candidate.ref === line.ref);
  const live = line.state !== "done" && line.state !== "dropped";
  const forYou = home?.lines[line.ref]?.forYou ?? [];
  return (
    <div className="line-panel">
      <LinePanelHead
        line={line}
        position={at === -1 ? null : `Line ${at + 1} of ${order.length}`}
        repos={line.repos.map(h.repoName)}
      />
      {starting ? (
        <StartSheet
          line={line}
          onDoneWhen={h.doneWhen}
          onStart={(ref) => {
            h.start(ref);
            setStarting(false);
          }}
          onCancel={() => setStarting(false)}
        />
      ) : (
        <LineActions
          line={line}
          owner={owner}
          // A line that waited may hold questions and tasks, so Start goes through its Start sheet.
          onChoose={(choice) =>
            choice === "start" && (line.state === "up_next" || line.state === "tabled")
              ? setStarting(true)
              : choices.choose(choice)
          }
          onTable={choices.table}
          foldTargets={order.filter((other) => other.ref !== line.ref)}
          onFold={(into) => h.fold(line.ref, into)}
          held={{
            questions: forYou.filter((item) => item.kind === "question").length,
            tasks: forYou.filter((item) => item.kind === "task").length,
          }}
        />
      )}
      <SummaryBox line={line} owner={owner} />
      <PanelForYou title={line.title} items={forYou} h={h} />
      <div className="panel-grid">
        <PlanList steps={shown.data?.steps ?? []} work={shown.data?.work ?? []} />
        <div className="panel-column">
          <SinceSummary
            line={line.ref}
            events={since.data?.events ?? []}
            summaryAt={line.summaryAt}
            seenAt={seenAt}
          />
          <OwnerBox
            line={line}
            crew={crew}
            repos={h.repos}
            onStop={choices.stop}
            onOwn={() => choices.choose("own")}
            onHand={choices.hand}
          />
        </div>
      </div>
      {!live ? null : line.ownedBy !== null ? (
        <OwnWorkBox
          line={line.ref}
          words={own.value}
          onWords={own.change}
          onTask={(title) => void own.flush().then(() => choices.addTask(title))}
          onNote={(body) => void own.flush().then(() => choices.addNote(body))}
          sending={choicesWaiting(`own:${line.ref}`)}
        />
      ) : line.state === "working" ? (
        <TellBox
          line={line.ref}
          to={owner}
          words={tell.value}
          onWords={tell.change}
          focus={telling}
          sending={choicesWaiting(`tell:${line.ref}`)}
          onSend={(words) => void tell.flush().then(() => choices.tell(words))}
        />
      ) : null}
      <NotKept error={tell.error ?? own.error} />
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
      {h.failure === null ? null : <ErrorState error={h.failure} />}
    </div>
  );
}
