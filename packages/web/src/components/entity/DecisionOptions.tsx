import type { Decision } from "@octotrack/core/schemas";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/** A question's options, read only, one row each: its key, its words, what it does, and the one marked. */
export function DecisionOptions({
  options,
  marked,
  mark,
}: {
  options: Decision["options"];
  /** The key of the option to mark, such as the one chosen. */
  marked: string | null;
  /** How the marked one is said: chosen, recommended. */
  mark: string;
}) {
  if (options.length === 0) return null;
  return (
    <Section title="Options" count={options.length}>
      <List>
        {options.map((option) => (
          <Row
            key={option.key}
            lead={option.key}
            title={option.label}
            {...(option.key === marked ? { facts: mark } : {})}
            {...(option.description === "" ? {} : { note: option.description })}
          />
        ))}
      </List>
    </Section>
  );
}
