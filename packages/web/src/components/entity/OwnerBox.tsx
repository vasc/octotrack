import type { Line, LineCrew } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * Who speaks for the line: its owner and how it is, its helpers; Stop on the owner, and I'll own it; or, on a line the
 * developer owns, Hand to an agent, which asks for repos only when the line names none.
 */
export function OwnerBox({
  line,
  crew,
  repos,
  onStop,
  onOwn,
  onHand,
  waitingOnYou = false,
  stepIn = null,
}: {
  line: Line;
  /** All the line's open work waits on the developer. */
  waitingOnYou?: boolean;
  /** Why no owner can be found, as Step in says it, when the line needs the developer to step in. */
  stepIn?: string | null;
  crew: LineCrew | undefined;
  repos: readonly string[];
  onStop(name: string): void;
  onOwn(): void;
  onHand(repos: string[]): void;
}) {
  const [handing, setHanding] = useState<readonly string[] | null>(null);
  const owner = crew?.owner ?? null;
  const helpers = crew?.helpers ?? [];
  if (line.state !== "working") return null;
  return (
    <Section title="Owner">
      <List>
        {line.ownedBy !== null ? (
          <Row title="You" />
        ) : owner === null ? (
          <Row title="no owner" {...(stepIn === null ? {} : { note: stepIn })} />
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
      {handing === null ? (
        <Actions>
          {owner === null ? null : <Button onClick={() => onStop(owner.name)}>Stop {owner.name}</Button>}
          {line.ownedBy === null ? (
            <Button onClick={onOwn}>I'll own it</Button>
          ) : (
            // A line that names its repos goes straight back; one that names none asks which first.
            <Button onClick={() => (line.repos.length > 0 ? onHand([]) : setHanding([]))}>
              Hand to an agent
            </Button>
          )}
        </Actions>
      ) : (
        <>
          <List label="Its repos">
            {repos.map((repo) => (
              <Row
                key={repo}
                title={repo}
                checked={handing.includes(repo)}
                onToggle={() =>
                  setHanding(
                    handing.includes(repo) ? handing.filter((other) => other !== repo) : [...handing, repo],
                  )
                }
              />
            ))}
          </List>
          <Actions>
            <Button
              variant="primary"
              disabled={handing.length === 0}
              onClick={() => {
                onHand([...handing]);
                setHanding(null);
              }}
            >
              Hand over
            </Button>
            <Button onClick={() => setHanding(null)}>Cancel</Button>
          </Actions>
        </>
      )}
    </Section>
  );
}
