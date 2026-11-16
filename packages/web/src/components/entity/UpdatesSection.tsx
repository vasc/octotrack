import { contracts } from "@octotrack/core/contracts";
import type { StatusUpdate } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { Actions } from "../ui/Actions.tsx";
import { StatusBadge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { Note } from "../ui/Note.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { TextBox } from "../ui/TextBox.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** Notes on an item: a box to post one, which waits with Undo like any choice, then each note with who and when. */
export function UpdatesSection({ target, updates }: { target: string; updates: readonly StatusUpdate[] }) {
  const key = `update:${target}`;
  const draft = useDraft(key);
  const body = draft.value;
  const choices = useChoices();
  const sending = choices.waiting(key);
  // The server deletes its draft once it is posted.
  const post = () => {
    const words = body.trim();
    if (words === "" || sending) return;
    void draft
      .flush()
      .then(() =>
        choices.make(
          contracts.updatePost.name,
          { body: words, target },
          `Posting a note on ${target}: ${words}`,
          key,
        ),
      );
  };
  return (
    <Section title="Updates" {...(updates.length === 0 ? {} : { count: updates.length })}>
      {updates.length === 0 ? <Note>No updates yet.</Note> : null}
      <TextBox
        label={`Post an update on ${target}`}
        placeholder="Post an update"
        value={body}
        onChange={draft.change}
        onSubmit={post}
      />
      <Actions>
        <Button disabled={body.trim() === ""} busy={sending ? "Posting…" : undefined} onClick={post}>
          Post
        </Button>
      </Actions>
      <NotKept unsaved={draft.error !== null} />
      {updates.length === 0 ? null : (
        <List>
          {updates.map((update) => (
            <Row
              key={update.ref}
              title={<RefText text={update.body} />}
              facts={
                <Facts>
                  <StatusBadge value={update.level} />
                  {update.actor}
                  <TimeAgo iso={update.createdAt} />
                </Facts>
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}
