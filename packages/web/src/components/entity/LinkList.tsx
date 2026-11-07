import type { EntitySummary, Link } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
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

export function LinkList({ entityRef, links, linked }: LinkListProps) {
  if (links.length === 0) return null;
  return (
    <Section title="Connections" note={String(links.length)}>
      <div className="rows">
        {links.map((link) => {
          const { label, other } = describe(link, entityRef);
          const summary = linked.find((item) => item.ref === other);
          return (
            <div className="row" key={`${link.fromRef}|${link.rel}|${link.toRef}`}>
              <span className="muted" style={{ flex: "none" }}>
                {label}
              </span>
              <RefLink value={other} />
              <span className="row-title" style={{ cursor: "default" }} title={summary?.title}>
                {summary?.title}
              </span>
              {summary === undefined ? null : <StatusBadge value={summary.status} />}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
