import type { Line } from "@octotrack/core/schemas";
import { LINE_STATE_LABEL, recommendationText } from "../../lib/lines.ts";
import { KeyValues } from "./KeyValues.tsx";

/** A line of work: where it stands, what finishes it, and why it waits if it does. */
export function LinePanel({ line }: { line: Line }) {
  return (
    <>
      <KeyValues
        items={[
          ["State", LINE_STATE_LABEL[line.state]],
          ["Repos", line.repos.join(", ")],
          ["Tabled because", line.tabledReason],
          ["Look again", line.lookAgainAt],
          ["Recommends", recommendationText(line)],
          ["From before", line.fromRef],
        ]}
      />
      {line.doneWhen === "" ? null : (
        <p className="prose">
          <strong>Done when</strong> {line.doneWhen}
        </p>
      )}
      {line.recommendationWhy === null ? null : <p className="prose">{line.recommendationWhy}</p>}
    </>
  );
}
