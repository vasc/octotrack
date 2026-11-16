import type { Line, LineCrew } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * Who speaks for the line, on every live line: its owner and how it is, its helpers, with Stop and I'll own it; the
 * developer, on a line they own; or, on a line that waits, that nobody owns it until it starts and who may scope it.
 */
export function OwnerBox({
  line,
  crew,
  repoNames,
  onStop,
  onOwn,
  waitingOnYou = false,
  status,
}: {
  line: Line;
  crew: LineCrew | undefined;
  /** The line's repos, by GitHub name where one is set. */
  repoNames: readonly string[];
  onStop(name: string): void;
  onOwn(): void;
  /** All the line's open work waits on the developer. */
  waitingOnYou?: boolean;
  /** Lines is loading or failed, so who owns it is not known yet: said in place of the owner and its moves. */
  status?: ReactNode;
}) {
  if (line.state === "done" || line.state === "dropped") return null;
  const owner = crew?.owner ?? null;
  const helpers = crew?.helpers ?? [];
  if (line.state !== "working") {
    return (
      <Section title="Owner">
        <Note>
          {repoNames.length === 0
            ? "None until it starts."
            : `None until it starts. An idle agent in ${repoNames.join(", ")} may scope it meanwhile.`}
        </Note>
      </Section>
    );
  }
  if (status !== undefined) return <Section title="Owner">{status}</Section>;
  return (
    <Section title="Owner">
      <List>
        {line.ownedBy !== null ? (
          <Row title="You" />
        ) : owner === null ? (
          <Row title="no owner" />
        ) : (
          <Row
            title={owner.name}
            facts={
              <Facts>
                {owner.state}
                {waitingOnYou ? "waits on you" : null}
                {helpers.length === 0 ? null : `helping: ${helpers.map((helper) => helper.name).join(", ")}`}
              </Facts>
            }
          />
        )}
      </List>
      {line.ownedBy !== null ? null : (
        <Actions>
          {owner === null ? null : <Button onClick={() => onStop(owner.name)}>Stop {owner.name}</Button>}
          <Button onClick={onOwn}>I'll own it</Button>
        </Actions>
      )}
    </Section>
  );
}
