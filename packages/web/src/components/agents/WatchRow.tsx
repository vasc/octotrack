import type { Watch } from "@octotrack/core/schemas";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** Who is watching what, in the terms the agent itself asked for. */
export function WatchRow({ watch }: { watch: Watch }) {
  const joiner = watch.spec.require === "all" ? " AND " : " OR ";
  return (
    <div className="row">
      <span style={{ fontWeight: 500 }}>{watch.agent}</span>
      <code className="row-title" style={{ cursor: "default", fontFamily: "var(--mono)", fontSize: 12 }}>
        {watch.spec.clauses.map((clause) => clause.query).join(joiner)}
      </code>
      {watch.name === null ? null : <span className="muted">{watch.name}</span>}
      <TimeAgo iso={watch.createdAt} />
    </div>
  );
}
