import type { SyncFailure } from "@octotrack/core/schemas";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/** PR status that has stopped updating looks exactly like PR status that is current, unless something says so. */
export function SyncFailures({ failures }: { failures: readonly SyncFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <Section title="PR status is stale">
      <List>
        {failures.map((failure) => (
          <Row key={failure.repo} title={failure.repo} note={failure.error} />
        ))}
      </List>
    </Section>
  );
}
