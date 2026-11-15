import { contracts } from "@octotrack/core/contracts";
import type { StatusUpdate } from "@octotrack/core/schemas";
import { useDraft } from "../../hooks/useDraft.ts";
import { useChoices } from "../../hooks/useChoices.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Section } from "../ui/Section.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export function UpdatesSection({ target, updates }: { target: string; updates: readonly StatusUpdate[] }) {
  const key = `update:${target}`;
  const draft = useDraft(key);
  const body = draft.value;
  const choices = useChoices();
  const sending = choices.waiting(key);
  // A note waits with Undo like any choice; the server deletes its draft once it is posted.
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
    <Section title="Updates" {...(updates.length === 0 ? {} : { note: String(updates.length) })}>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          post();
        }}
      >
        <TextBox
          label={`Post an update on ${target}`}
          placeholder="Post an update. Markdown works; Cmd+Enter posts"
          value={body}
          onChange={draft.change}
          onSubmit={post}
        />
        <button type="submit" className="btn" disabled={body.trim() === "" || sending}>
          {sending ? "Posting" : "Post"}
        </button>
      </form>
      <NotKept error={draft.error} />
      {updates.map((update) => (
        <div className="history-row" key={update.ref}>
          <StatusBadge value={update.level} /> <RefText text={update.body} />{" "}
          <span className="muted">{update.actor}</span> <TimeAgo iso={update.createdAt} />
        </div>
      ))}
    </Section>
  );
}
