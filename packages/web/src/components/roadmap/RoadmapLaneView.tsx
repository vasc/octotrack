import type { RoadmapLane } from "@octotrack/core/schemas";
import { Badge } from "../ui/Badge.tsx";
import { Progress } from "../ui/Progress.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";

const TITLES: Readonly<Record<RoadmapLane["horizon"], string>> = { now: "Now", next: "Next", later: "Later" };

export function RoadmapLaneView({ lane }: { lane: RoadmapLane }) {
  return (
    <section className="lane" data-horizon={lane.horizon}>
      <h2 className="lane-title">{TITLES[lane.horizon]}</h2>
      {lane.items.length === 0 ? <p className="muted">Nothing here.</p> : null}
      {lane.items.map((item) => (
        <div className="card" key={item.ref}>
          <div className="row-sub">
            <RefLink value={item.ref} />
            <Badge>{item.kind}</Badge>
            {item.project === null ? null : <span>{item.project}</span>}
          </div>
          <span className="card-title">{item.title}</span>
          {item.total > 0 ? <Progress done={item.done} total={item.total} /> : null}
          <div className="card-stats">
            {item.total > 0 ? (
              <span>
                {item.done}/{item.total} done
              </span>
            ) : null}
            {item.targetDate === null ? null : <span>{item.targetDate.slice(0, 10)}</span>}
            {item.openDecisions.length === 0 ? null : (
              <span className="stat-hot">
                waiting on <RefText text={item.openDecisions.join(", ")} />
              </span>
            )}
            {item.blockedBy.length === 0 ? null : (
              <span className="stat-hot">
                blocked by <RefText text={item.blockedBy.join(", ")} />
              </span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
