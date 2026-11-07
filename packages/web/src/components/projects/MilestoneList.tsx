import type { RoadmapItem } from "@octotrack/core/schemas";
import { StatusBadge } from "../ui/Badge.tsx";
import { Progress } from "../ui/Progress.tsx";
import { RefLink } from "../ui/RefLink.tsx";

export function MilestoneList({ items }: { items: readonly RoadmapItem[] }) {
  return (
    <div className="rows">
      {items.map((item) => (
        <div className="row" key={item.ref}>
          <RefLink value={item.ref} />
          <div className="row-stack">
            <span>{item.title}</span>
            {item.total > 0 ? <Progress done={item.done} total={item.total} /> : null}
          </div>
          {item.targetDate === null ? null : <span className="muted">{item.targetDate.slice(0, 10)}</span>}
          <StatusBadge value={item.status} />
        </div>
      ))}
    </div>
  );
}
