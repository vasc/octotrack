import type { EntitySummary, Link } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/** How to say a relation from the point of view of the item being shown. */
function describe(link: Link, ref: string): { label: string; other: string } {
  if (link.fromRef === ref) return { label: humanize(link.rel), other: link.toRef };
  const inverse: Readonly<Record<Link["rel"], string>> = {
    blocks: "blocked by",
    implements: "implemented by",
    affects: "affected by",
    derived_from: "source of",
    supersedes: "superseded by",
    promoted_to: "promoted from",
    relates: "relates",
  };
  return { label: inverse[link.rel], other: link.fromRef };
}

export interface LinkListProps {
  entityRef: string;
  links: readonly Link[];
  linked: readonly EntitySummary[];
}

/** What an item connects to, one row each: the other item's title, how it relates, its ref and its state. */
export function LinkList({ entityRef, links, linked }: LinkListProps) {
  if (links.length === 0) return null;
  return (
    <Section title="Connections" count={links.length}>
      <List>
        {links.map((link) => {
          const { label, other } = describe(link, entityRef);
          const summary = linked.find((item) => item.ref === other);
          return (
            <Row
              key={`${link.fromRef}|${link.rel}|${link.toRef}`}
              title={summary === undefined ? <RefLink value={other} /> : summary.title}
              facts={
                <Facts>
                  {label}
                  {summary === undefined ? "no longer exists" : <RefLink value={other} />}
                  {summary === undefined ? null : <StatusBadge value={summary.status} />}
                </Facts>
              }
            />
          );
        })}
      </List>
    </Section>
  );
}
