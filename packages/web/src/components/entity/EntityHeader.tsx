import type { EntitySummary } from "@octotrack/core/schemas";
import { closeEntity } from "../../lib/router.ts";
import { Badge, StatusBadge } from "../ui/Badge.tsx";

export function EntityHeader({ summary }: { summary: EntitySummary }) {
  return (
    <header>
      <div className="detail-head">
        <span className="ref">{summary.ref}</span>
        <Badge>{summary.kind}</Badge>
        <StatusBadge value={summary.status} />
        <button type="button" className="detail-close" aria-label="Close" onClick={closeEntity}>
          ✕
        </button>
      </div>
      <h2 className="detail-title" style={{ marginTop: 6 }}>
        {summary.title}
      </h2>
    </header>
  );
}
