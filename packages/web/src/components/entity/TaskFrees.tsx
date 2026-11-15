import type { EntitySummary } from "@octotrack/core/schemas";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/** What a task frees, as E-Issue draws it: each freed issue, openable, and who holds it. */
export function TaskFrees({ freed }: { freed: readonly EntitySummary[] }) {
  if (freed.length === 0) return null;
  return (
    <Section title="What it frees" count={freed.length}>
      <List>
        {freed.map((item) => (
          <Row
            key={item.ref}
            title={item.title}
            facts={
              <Facts>
                <RefLink value={item.ref} />
                {item.assignee === null ? "nobody holds it" : `held by ${item.assignee}`}
              </Facts>
            }
          />
        ))}
      </List>
    </Section>
  );
}
