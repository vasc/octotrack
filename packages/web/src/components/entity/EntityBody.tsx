import type { EntityDetail } from "@octotrack/core/schemas";
import { DecisionPanel } from "./DecisionPanel.tsx";
import { IssuePanel } from "./IssuePanel.tsx";
import { KeyValues } from "./KeyValues.tsx";
import { PrPanel } from "./PrPanel.tsx";

/** The part that differs by kind of item. */
export function EntityBody({ entity }: { entity: EntityDetail["entity"] }) {
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
  if ("level" in entity) return <p className="prose">{entity.body}</p>;
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
        {entity.body === "" ? null : <p className="prose">{entity.body}</p>}
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
      {entity.description === "" ? null : <p className="prose">{entity.description}</p>}
    </>
  );
}
