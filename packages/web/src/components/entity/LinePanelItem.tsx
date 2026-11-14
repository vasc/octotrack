import { contracts } from "@octotrack/core/contracts";
import type { Line } from "@octotrack/core/schemas";
import { useDraft } from "../../hooks/useDraft.ts";
import { useLineChoices } from "../../hooks/useLineChoices.ts";
import { useMarkSeen } from "../../hooks/useMarkSeen.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useRoute } from "../../lib/router.ts";
import { ErrorState } from "../ui/states.tsx";
import { LineActions } from "./LineActions.tsx";
import { LinePanel } from "./LinePanel.tsx";
import { OwnWorkBox } from "./OwnWorkBox.tsx";
import { TellBox } from "./TellBox.tsx";

/** A line in the inspector: what it is, what the developer can do with it, and what they can say to it. */
export function LinePanelItem({ line }: { line: Line }) {
  const choices = useLineChoices(line);
  const home = useOpQuery(contracts.homeShow, {});
  const tell = useDraft(`tell:${line.ref}`);
  const own = useDraft(`own:${line.ref}`);
  useMarkSeen(line.ref);
  const owner = home.data?.crews[line.ref]?.owner?.name ?? null;
  // Opened with t from home: straight to tabling.
  const tabling = useRoute().params.get("act") === "table";
  const live = line.state !== "done" && line.state !== "dropped";
  const mine = line.ownedBy !== null;
  return (
    <>
      <LinePanel line={line} />
      <LineActions
        line={line}
        onChoose={choices.choose}
        onTable={choices.table}
        onDoneWhen={choices.doneWhen}
        owner={owner}
        onStopOwner={choices.stop}
        tabling={tabling}
      />
      {!live ? null : mine ? (
        <OwnWorkBox
          line={line.ref}
          words={own.value}
          onWords={own.change}
          onTask={(title) => {
            choices.addTask(title);
            own.clear();
          }}
          onNote={(body) => {
            choices.addNote(body);
            own.clear();
          }}
        />
      ) : line.state === "working" ? (
        <TellBox
          line={line.ref}
          to={owner}
          words={tell.value}
          onWords={tell.change}
          onSend={(words) => {
            choices.tell(words);
            tell.clear();
          }}
        />
      ) : null}
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
    </>
  );
}
