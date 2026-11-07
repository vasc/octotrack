import type { Horizon, Idea, Milestone, Project, Roadmap, RoadmapItem, RoadmapLane } from "./schemas.ts";
import { type Ctx, rows } from "./store/context.ts";
import type { GraphSnapshot } from "./store/graph.ts";
import { IdeaRow, IssueRow, MilestoneRow, ProjectRow, DecisionRow } from "./store/rows.ts";

type LaneName = RoadmapLane["horizon"];

const SOON_MS = 30 * 86_400_000;

/** An explicit horizon always wins. Otherwise status and target date decide, so a roadmap needs no upkeep. */
function milestoneLane(milestone: Milestone, now: string): LaneName {
  if (milestone.horizon !== "none") return laneOf(milestone.horizon);
  if (milestone.status === "active") return "now";
  if (milestone.targetDate !== null && Date.parse(milestone.targetDate) - Date.parse(now) < SOON_MS)
    return "next";
  return "later";
}

function laneOf(horizon: Exclude<Horizon, "none">): LaneName {
  return horizon;
}

function ideaLane(idea: Idea): LaneName {
  return idea.horizon === "none" ? "later" : laneOf(idea.horizon);
}

function projectLane(project: Project): LaneName {
  if (project.horizon !== "none") return laneOf(project.horizon);
  return project.status === "active" ? "now" : "later";
}

function byTargetDate(a: RoadmapItem, b: RoadmapItem): number {
  if (a.targetDate === b.targetDate) return a.ref.localeCompare(b.ref);
  if (a.targetDate === null) return 1;
  if (b.targetDate === null) return -1;
  return a.targetDate.localeCompare(b.targetDate);
}

export function renderRoadmapMarkdown(roadmap: Omit<Roadmap, "markdown">): string {
  const heading = roadmap.project === null ? "Roadmap" : `Roadmap: ${roadmap.project}`;
  const lines = [`# ${heading}`, "", `Generated ${roadmap.generatedAt}`];
  const titles: Readonly<Record<LaneName, string>> = { now: "Now", next: "Next", later: "Later" };
  for (const lane of roadmap.lanes) {
    lines.push("", `## ${titles[lane.horizon]}`, "");
    if (lane.items.length === 0) lines.push("Nothing here yet.");
    for (const item of lane.items) {
      const details = [
        item.total > 0 ? `${item.done}/${item.total} done` : null,
        item.targetDate === null ? null : `target ${item.targetDate.slice(0, 10)}`,
        item.blockedBy.length === 0 ? null : `blocked by ${item.blockedBy.join(", ")}`,
        item.openDecisions.length === 0 ? null : `waiting on ${item.openDecisions.join(", ")}`,
      ].filter((detail) => detail !== null);
      const suffix = details.length === 0 ? "" : ` (${details.join("; ")})`;
      lines.push(`- **${item.ref}** ${item.title}${suffix}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function generateRoadmap(ctx: Ctx, projectKey: string | null, graph: GraphSnapshot): Roadmap {
  const projects = rows(
    ctx,
    ProjectRow,
    "SELECT * FROM projects WHERE status NOT IN ('done', 'archived')",
  ).filter((project) => projectKey === null || project.ref === projectKey);
  const milestones = rows(
    ctx,
    MilestoneRow,
    "SELECT * FROM milestones WHERE status IN ('planned', 'active')",
  ).filter((milestone) => projectKey === null || milestone.project === projectKey);
  const ideas = rows(
    ctx,
    IdeaRow,
    "SELECT * FROM ideas WHERE status IN ('captured', 'exploring', 'planned')",
  ).filter((idea) => idea.horizon !== "none" && (projectKey === null || idea.project === projectKey));
  const issues = rows(ctx, IssueRow, "SELECT * FROM issues");
  const openDecisions = rows(ctx, DecisionRow, "SELECT * FROM decisions WHERE status = 'open'");

  const blockingDecisions = (refs: readonly string[]): string[] =>
    openDecisions
      .filter((decision) => graph.blocking(decision.ref).some((blocked) => refs.includes(blocked)))
      .map((decision) => decision.ref);

  const items: { lane: LaneName; item: RoadmapItem }[] = [];

  for (const milestone of milestones) {
    const own = issues.filter((issue) => issue.milestone === milestone.ref);
    const refs = own.map((issue) => issue.ref);
    items.push({
      lane: milestoneLane(milestone, ctx.now),
      item: {
        ref: milestone.ref,
        kind: "milestone",
        title: milestone.title,
        project: milestone.project,
        status: milestone.status,
        horizon: milestone.horizon,
        targetDate: milestone.targetDate,
        done: own.filter((issue) => issue.status === "done" || issue.status === "cancelled").length,
        total: own.length,
        blockedBy: graph.openBlockersOf(milestone.ref),
        openDecisions: blockingDecisions([milestone.ref, ...refs]),
      },
    });
  }

  // A project with milestones is already represented by them; show it directly only if it has none.
  const withMilestones = new Set(milestones.map((milestone) => milestone.project));
  for (const project of projects) {
    if (withMilestones.has(project.ref)) continue;
    const own = issues.filter((issue) => issue.project === project.ref);
    items.push({
      lane: projectLane(project),
      item: {
        ref: project.ref,
        kind: "project",
        title: project.name,
        project: project.ref,
        status: project.status,
        horizon: project.horizon,
        targetDate: project.targetDate,
        done: own.filter((issue) => issue.status === "done" || issue.status === "cancelled").length,
        total: own.length,
        blockedBy: graph.openBlockersOf(project.ref),
        openDecisions: blockingDecisions([project.ref, ...own.map((issue) => issue.ref)]),
      },
    });
  }

  for (const idea of ideas) {
    items.push({
      lane: ideaLane(idea),
      item: {
        ref: idea.ref,
        kind: "idea",
        title: idea.title,
        project: idea.project,
        status: idea.status,
        horizon: idea.horizon,
        targetDate: null,
        done: 0,
        total: 0,
        blockedBy: graph.openBlockersOf(idea.ref),
        openDecisions: blockingDecisions([idea.ref]),
      },
    });
  }

  const laneNames: readonly LaneName[] = ["now", "next", "later"];
  const lanes = laneNames.map((horizon) => ({
    horizon,
    items: items
      .filter((entry) => entry.lane === horizon)
      .map((entry) => entry.item)
      .sort(byTargetDate),
  }));
  const base = { generatedAt: ctx.now, project: projectKey, lanes };
  return { ...base, markdown: renderRoadmapMarkdown(base) };
}
