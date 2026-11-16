import type { Line } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";

type Group = NonNullable<Line["recommendation"]> | "none";

const GROUP_TITLE: Readonly<Record<Group, string>> = {
  start: "Recommended to start",
  up_next: "Recommended for up next",
  table: "Recommended to table",
  fold: "Recommended to fold into another",
  none: "No recommendation",
};

const ORDER: readonly Group[] = ["start", "up_next", "table", "fold", "none"];

/** How many of the first group show before "Show N more". */
const FIRST_SHOWN = 4;

/**
 * Proposals before anything is placed, grouped by where their agents recommend each goes: the first group open with a
 * few and the rest a press away, every other group folded to a sample and Show.
 */
export function ProposalGroups({
  proposals,
  card,
}: {
  proposals: readonly Line[];
  /** Draws one proposal, with its moves. */
  card(proposal: Line): ReactNode;
}) {
  const groups = ORDER.map(
    (group) => [group, proposals.filter((line) => (line.recommendation ?? "none") === group)] as const,
  ).filter(([, lines]) => lines.length > 0);
  return (
    <>
      {groups.map(([group, lines], index) => (
        <ProposalGroup key={group} title={GROUP_TITLE[group]} lines={lines} open={index === 0} card={card} />
      ))}
    </>
  );
}

/** One group: open with its first few and "Show N more", or folded to a sample with Show. */
function ProposalGroup({
  title,
  lines,
  open,
  card,
}: {
  title: string;
  lines: readonly Line[];
  open: boolean;
  card(proposal: Line): ReactNode;
}) {
  // How far a group is opened is a choice on this screen alone, so it is the component's own state.
  const [shown, setShown] = useState(open ? FIRST_SHOWN : 0);
  const visible = lines.slice(0, shown);
  const rest = lines.length - visible.length;
  return (
    <Section
      title={title}
      count={lines.length}
      {...(shown === 0 ? { aside: <Button onClick={() => setShown(lines.length)}>Show</Button> } : {})}
    >
      {shown === 0 ? (
        <Note>
          Includes {lines[0]?.title}
          {rest > 1 ? `, and ${rest - 1} more.` : "."}
        </Note>
      ) : (
        <>
          <List>{visible.map(card)}</List>
          {rest === 0 ? null : (
            <Actions>
              <Button onClick={() => setShown(lines.length)}>Show {rest} more</Button>
            </Actions>
          )}
        </>
      )}
    </Section>
  );
}
