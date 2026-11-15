import type { EntityDetail } from "@octotrack/core/schemas";
import { DecisionPanel } from "./DecisionPanel.tsx";
import { KeyValues } from "./KeyValues.tsx";
import { PrPanel } from "./PrPanel.tsx";
import { Markdown } from "../ui/Markdown.tsx";

/** The part that differs by kind of item. */
export function EntityBody({
  entity,
  links,
}: {
  entity: EntityDetail["entity"];
  links: EntityDetail["links"];
}) {
  // A line has a panel of its own, which EntityPanel shows instead.
  if ("doneWhen" in entity) return null;
  if ("options" in entity) {
    const waitsFor = links
      .filter((link) => link.rel === "blocks" && link.toRef === entity.ref)
      .map((link) => link.fromRef);
    return <DecisionPanel decision={entity} waitsFor={waitsFor} />;
  }
  if ("number" in entity) return <PrPanel pr={entity} />;
  if ("priority" in entity) return null;
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
