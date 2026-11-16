import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export interface OwnWorkBoxProps {
  line: string;
  words: string;
  onWords(words: string): void;
  onTask(title: string): void;
  onNote(body: string): void;
  /** The repos the line names: with any, it goes straight back to the agents; with none, it asks which first. */
  repos: readonly string[];
  /** Every repo there is, to pick from when the line names none. */
  allRepos: readonly string[];
  /** Gives the line back to the agents, naming its repos when it had none. */
  onHand(repos: string[]): void;
  /** What was typed is on its way, waiting with Undo: not sent again. */
  sending?: boolean;
}

/**
 * On a line the developer owns, one growing box: what is typed becomes a task of theirs or a note on the line; and
 * Hand to an agent beside them, which gives the line back to the agents.
 */
export function OwnWorkBox({
  line,
  words,
  onWords,
  onTask,
  onNote,
  repos,
  allRepos,
  onHand,
  sending = false,
}: OwnWorkBoxProps) {
  // Picking repos to hand over with is a step on this screen alone, so it is the component's own state.
  const [handing, setHanding] = useState<readonly string[] | null>(null);
  // Which add was pressed, so that it says it is on its way while it waits.
  const [pressed, setPressed] = useState<"task" | "note" | null>(null);
  const text = words.trim();
  const off = text === "" || sending;
  const busy = (which: "task" | "note") => (sending && pressed === which ? "Adding…" : undefined);
  return (
    <Section title="Add a task or a note">
      <TextBox label={`Add to ${line}`} placeholder="A task, or a note" value={words} onChange={onWords} />
      {handing === null ? (
        <Actions>
          <Button
            disabled={off}
            busy={busy("task")}
            onClick={() => {
              setPressed("task");
              onTask(text);
            }}
          >
            Add as a task
          </Button>
          <Button
            disabled={off}
            busy={busy("note")}
            onClick={() => {
              setPressed("note");
              onNote(text);
            }}
          >
            Add as a note
          </Button>
          <Button variant="quiet" onClick={() => (repos.length > 0 ? onHand([]) : setHanding([]))}>
            Hand to an agent
          </Button>
        </Actions>
      ) : (
        <>
          <List label="Its repos">
            {allRepos.map((repo) => (
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
