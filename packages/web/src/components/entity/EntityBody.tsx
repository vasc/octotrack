import type { EntityDetail, Line } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { DecisionPanel } from "./DecisionPanel.tsx";
import { DriftBody } from "./DriftBody.tsx";
import { PrPanel } from "./PrPanel.tsx";

/**
 * The part that differs by kind of item: a question, a pull request, drift answered in place, a repo with its lines, or
 * something from before lines saying what it became.
 */
export function EntityBody({
  entity,
  links,
  lines,
}: {
  entity: EntityDetail["entity"];
  links: EntityDetail["links"];
  /** Every line the page knows: a repo's own, and what an old idea or milestone became. */
  lines: readonly Line[];
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
  if ("rule" in entity) return <DriftBody drift={entity} />;
  if ("level" in entity) return <Markdown text={entity.body} />;
  // A repo: where it lives on GitHub and here, and its lines.
  if ("checkout" in entity) {
    const own = lines.filter((line) => line.repos.includes(entity.ref));
    return (
      <Stack>
        <Pairs
          pairs={[
            ["GitHub", entity.repo ?? "none"],
            ["Checkout", entity.checkout ?? "none on this machine"],
          ]}
        />
        {entity.description === "" ? null : <Markdown text={entity.description} />}
        <Section title="Lines" count={own.length}>
          {own.length === 0 ? (
            <Note>No line names it yet.</Note>
          ) : (
            <List>
              {own.map((line) => (
                <Row
                  key={line.ref}
                  title={line.title}
                  facts={
                    <Facts>
                      <RefLink value={line.ref} />
                      {humanize(line.state)}
                    </Facts>
                  }
                />
              ))}
            </List>
          )}
        </Section>
      </Stack>
    );
  }
  // An idea or a milestone from before lines: what it became, or, when it became nothing, its old fields.
  const became = lines.find((line) => line.fromRef === entity.ref);
  const promoted = "promotedTo" in entity ? entity.promotedTo : null;
  if (became !== undefined || promoted !== null) {
    return (
      <Labelled label="Became">
        {became === undefined ? (
          <RefLink value={promoted ?? ""} />
        ) : (
          <>
            <RefLink value={became.ref} /> {became.title}
          </>
        )}
      </Labelled>
    );
  }
  const body = "body" in entity ? entity.body : entity.description;
  return (
    <Stack>
      <Labelled label="From before lines">
        <Pairs
          pairs={[
            ["Repo", entity.project],
            ["Horizon", entity.horizon],
            ["Target", "targetDate" in entity ? entity.targetDate : null],
            ["Labels", "labels" in entity ? entity.labels.join(", ") : null],
          ]}
        />
      </Labelled>
      {body === "" ? null : <Markdown text={body} />}
    </Stack>
  );
}
