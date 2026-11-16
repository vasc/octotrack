import type { EntitySummary } from "@octotrack/core/schemas";
import { List } from "../ui/List.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/** What a task frees, as E-Issue draws it: each freed issue, openable. Who holds it is not drawn. */
export function TaskFrees({ freed }: { freed: readonly EntitySummary[] }) {
  if (freed.length === 0) return null;
  return (
    <Section title="What it frees" count={freed.length}>
      <List>
        {freed.map((item) => (
          <Row key={item.ref} title={item.title} facts={<RefLink value={item.ref} />} />
        ))}
      </List>
    </Section>
  );
}
