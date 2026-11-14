import type { EntityDetail } from "@octotrack/core/schemas";
import { DecisionPanel } from "./DecisionPanel.tsx";
import { IssuePanel } from "./IssuePanel.tsx";
import { KeyValues } from "./KeyValues.tsx";
import { LinePanelItem } from "./LinePanelItem.tsx";
import { PrPanel } from "./PrPanel.tsx";
import { Markdown } from "../ui/Markdown.tsx";

/** The part that differs by kind of item. */
export function EntityBody({ entity }: { entity: EntityDetail["entity"] }) {
  if ("doneWhen" in entity) return <LinePanelItem line={entity} />;
  if ("options" in entity) return <DecisionPanel decision={entity} />;
  if ("number" in entity) return <PrPanel pr={entity} />;
  if ("priority" in entity) return <IssuePanel issue={entity} />;
  if ("rule" in entity) {
    return (
      <>
        <KeyValues
          items={[
            ["Rule", entity.rule],
            ["Target", entity.target],
            ["Caused by", entity.cause],
            ["Assigned", entity.assignee],
            ["Resolved by", entity.resolvedBy],
            ["Note", entity.note],
          ]}
        />
        <p className="drift-suggestion">{entity.suggestion}</p>
      </>
    );
  }
  if ("level" in entity) return <Markdown text={entity.body} />;
  if ("promotedTo" in entity) {
    return (
      <>
        <KeyValues
          items={[
            ["Project", entity.project],
            ["Horizon", entity.horizon],
            ["Promoted to", entity.promotedTo],
            ["Labels", entity.labels.join(", ")],
          ]}
        />
        {entity.body === "" ? null : <Markdown text={entity.body} />}
      </>
    );
  }
  return (
    <>
      <KeyValues
        items={[
          ["Project", "project" in entity ? entity.project : null],
          ["Repo", "repo" in entity ? entity.repo : null],
          ["Horizon", entity.horizon],
          ["Target", entity.targetDate],
        ]}
      />
      {entity.description === "" ? null : <Markdown text={entity.description} />}
    </>
  );
}
