import { contracts } from "@octotrack/core/contracts";
import type { StatusUpdate } from "@octotrack/core/schemas";
import { useState } from "react";
import { useOpMutation } from "../../hooks/useOp.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Section } from "../ui/Section.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export function UpdatesSection({ target, updates }: { target: string; updates: readonly StatusUpdate[] }) {
  const [body, setBody] = useState("");
  const post = useOpMutation(contracts.updatePost);
  return (
    <Section title="Updates" {...(updates.length === 0 ? {} : { note: String(updates.length) })}>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim() === "") return;
          post.mutate({ body: body.trim(), target });
          setBody("");
        }}
      >
        <input
          className="field"
          aria-label={`Post an update on ${target}`}
          placeholder="Post an update"
          value={body}
          onChange={(event) => setBody(event.target.value)}
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
