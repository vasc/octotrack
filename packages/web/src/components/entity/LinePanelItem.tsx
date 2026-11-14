import type { Line } from "@octotrack/core/schemas";
import { useLineChoices } from "../../hooks/useLineChoices.ts";
import { ErrorState } from "../ui/states.tsx";
import { LineActions } from "./LineActions.tsx";
import { LinePanel } from "./LinePanel.tsx";

/** A line in the inspector: what it is, and what the developer can do with it. */
export function LinePanelItem({ line }: { line: Line }) {
  const choices = useLineChoices(line.ref);
  return (
    <>
      <LinePanel line={line} />
      <LineActions
        line={line}
        onChoose={choices.choose}
        onTable={choices.table}
        onDoneWhen={choices.doneWhen}
      />
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
    </>
  );
}
