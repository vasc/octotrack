import type { ProjectCard } from "@octotrack/core/schemas";
import { navigate } from "../../lib/router.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { Progress } from "../ui/Progress.tsx";

function Stat({ value, label, hot = false }: { value: number; label: string; hot?: boolean }) {
  return (
    <span className={hot && value > 0 ? "stat-hot" : undefined}>
      {value} {label}
    </span>
  );
}

export function ProjectCardView({ card }: { card: ProjectCard }) {
  const { project, stats } = card;
  return (
    <a
      className="card"
      href={`/projects/${project.ref}`}
      onClick={(event) => {
        event.preventDefault();
        navigate(`/projects/${project.ref}`);
      }}
    >
      <div className="page-head">
        <span className="card-title">
          <span className="ref">{project.ref}</span> {project.name}
        </span>
        <StatusBadge value={project.status} />
      </div>
      {project.description === "" ? null : <p className="muted">{project.description}</p>}
      <Progress done={stats.issuesClosed} total={stats.issuesTotal} />
      <div className="card-stats">
        <span>
          {stats.issuesClosed}/{stats.issuesTotal} done
        </span>
        <Stat value={stats.openDecisions} label="decisions" hot />
        <Stat value={stats.openPrs} label="PRs" />
        <Stat value={stats.issuesBlocked} label="blocked" hot />
        <Stat value={stats.openDrift} label="drift" hot />
      </div>
    </a>
  );
}
