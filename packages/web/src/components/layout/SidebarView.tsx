import type { Counts, ProjectCard } from "@octotrack/core/schemas";
import type { LiveState } from "../../hooks/useLiveUpdates.ts";
import { NavItem } from "./NavItem.tsx";

export interface SidebarViewProps {
  path: string;
  live: LiveState;
  counts: Counts | null;
  projects: readonly ProjectCard[];
}

const LIVE_LABEL: Readonly<Record<LiveState, string>> = {
  connecting: "connecting",
  live: "live",
  offline: "offline",
};

export function SidebarView({ path, live, counts, projects }: SidebarViewProps) {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span>Octotrack</span>
        <span className="live" data-state={live}>
          {LIVE_LABEL[live]}
        </span>
      </div>
      <div className="nav-group">
        <NavItem label="Feed" to="/" current={path === "/"} />
        <NavItem
          label="Decisions"
          to="/decisions"
          current={path === "/decisions"}
          hot
          {...(counts === null ? {} : { count: counts.openDecisions })}
        />
        <NavItem
          label="Pull requests"
          to="/prs"
          current={path === "/prs"}
          hot={(counts?.failingPrs ?? 0) > 0}
          {...(counts === null ? {} : { count: counts.openPrs })}
        />
        <NavItem
          label="Drift"
          to="/drift"
          current={path === "/drift"}
          hot
          {...(counts === null ? {} : { count: counts.openDrift })}
        />
      </div>
      <div className="nav-group">
        <NavItem
          label="Issues"
          to="/issues"
          current={path === "/issues"}
          {...(counts === null ? {} : { count: counts.activeIssues })}
        />
        <NavItem label="Projects" to="/projects" current={path === "/projects"} />
        <NavItem label="Roadmap" to="/roadmap" current={path === "/roadmap"} />
        <NavItem
          label="Ideas"
          to="/ideas"
          current={path === "/ideas"}
          {...(counts === null ? {} : { count: counts.ideas })}
        />
        <NavItem
          label="Agents"
          to="/agents"
          current={path === "/agents"}
          hot
          {...(counts === null ? {} : { count: counts.waitingWatches })}
        />
      </div>
      {projects.length === 0 ? null : (
        <div className="nav-group" data-secondary="true">
          <div className="nav-heading">Projects</div>
          {projects.map(({ project, stats }) => (
            <NavItem
              key={project.ref}
              label={project.name}
              to={`/projects/${project.ref}`}
              current={path === `/projects/${project.ref}`}
              count={stats.openDecisions}
              hot
            />
          ))}
        </div>
      )}
      <div
        className="nav-group muted"
        data-secondary="true"
        style={{ padding: "0 8px", fontSize: 11, marginTop: "auto" }}
      >
        <span>/ filter · j k move · 1-9 pick · Enter decide · Esc close</span>
      </div>
    </nav>
  );
}
