import type { EntityDetail } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";
import { DecisionPanel } from "./DecisionPanel.tsx";
import { PrPanel } from "./PrPanel.tsx";

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
      <Stack>
        <Pairs
          pairs={[
            ["Rule", entity.rule],
            ["Target", entity.target],
            ["Caused by", entity.cause],
            ["Assigned", entity.assignee],
            ["Resolved by", entity.resolvedBy],
            ["Note", entity.note],
          ]}
        />
        <Markdown text={entity.suggestion} />
      </Stack>
    );
  }
  if ("level" in entity) return <Markdown text={entity.body} />;
  if ("promotedTo" in entity) {
    return (
      <Stack>
        <Pairs
          pairs={[
            ["Project", entity.project],
            ["Horizon", entity.horizon],
            ["Promoted to", entity.promotedTo],
            ["Labels", entity.labels.join(", ")],
          ]}
        />
        {entity.body === "" ? null : <Markdown text={entity.body} />}
      </Stack>
    );
  }
  return (
    <Stack>
      <Pairs
        pairs={[
          ["Project", "project" in entity ? entity.project : null],
          ["Repo", "repo" in entity ? entity.repo : null],
          ["Horizon", entity.horizon],
          ["Target", entity.targetDate],
        ]}
      />
      {entity.description === "" ? null : <Markdown text={entity.description} />}
    </Stack>
  );
}
