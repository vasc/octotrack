import { contracts } from "@octotrack/core/contracts";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { PageHead } from "../ui/PageHead.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { RoadmapLaneView } from "./RoadmapLaneView.tsx";

export function RoadmapPage() {
  const { params } = useRoute();
  const project = params.get("project");
  const { data: bootstrap } = useBootstrap();
  const roadmap = useOpQuery(contracts.roadmapGenerate, project === null ? {} : { project });
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <PageHead title="Roadmap">
        <div className="decision-actions">
          <select
            className="select"
            aria-label="Project"
            value={project ?? ""}
            onChange={(event) => setParams({ project: event.target.value })}
          >
            <option value="">All projects</option>
            {bootstrap?.projects.map((card) => (
              <option key={card.project.ref} value={card.project.ref}>
                {card.project.ref} {card.project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={roadmap.data === undefined}
            onClick={() => void navigator.clipboard.writeText(roadmap.data?.markdown ?? "")}
          >
            Copy as markdown
          </button>
        </div>
      </PageHead>
      {roadmap.isPending ? <LoadingState /> : null}
      {roadmap.error === null ? null : <ErrorState error={roadmap.error} />}
      <div className="lanes">
        {roadmap.data?.lanes.map((lane) => (
          <RoadmapLaneView key={lane.horizon} lane={lane} />
        ))}
      </div>
    </div>
  );
}
