import { contracts } from "@octotrack/core/contracts";
import type { StatusUpdate } from "@octotrack/core/schemas";
import { useDraft } from "../../hooks/useDraft.ts";
import { useOpMutation } from "../../hooks/useOp.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Section } from "../ui/Section.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export function UpdatesSection({ target, updates }: { target: string; updates: readonly StatusUpdate[] }) {
  const draft = useDraft(`update:${target}`);
  const body = draft.value;
  const post = useOpMutation(contracts.updatePost);
  return (
    <Section title="Updates" {...(updates.length === 0 ? {} : { note: String(updates.length) })}>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim() === "") return;
          post.mutate({ body: body.trim(), target });
          draft.clear();
        }}
      >
        <TextBox
          label={`Post an update on ${target}`}
          placeholder="Post an update. Markdown works; Cmd+Enter posts"
          value={body}
          onChange={draft.change}
          onSubmit={() => {
            if (body.trim() === "") return;
            post.mutate({ body: body.trim(), target });
            draft.clear();
          }}
        />
        <button type="submit" className="btn" disabled={body.trim() === ""}>
          Post
        </button>
      </form>
      {post.error === null ? null : <p className="error-text">{post.error.message}</p>}
      {updates.map((update) => (
        <div className="history-row" key={update.ref}>
          <StatusBadge value={update.level} /> <RefText text={update.body} />{" "}
          <span className="muted">{update.actor}</span> <TimeAgo iso={update.createdAt} />
        </div>
      ))}
    </Section>
  );
}
