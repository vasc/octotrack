import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import { assertProjectKey } from "../refs.ts";
import type { EventAttrs, Milestone, Project } from "../schemas.ts";
import { applyPatch, assertVersion, emit, nextNumber } from "../store/common.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { getMilestone, getProject, requireMilestone, requireProject } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { MilestoneRow, ProjectRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { buildProjectCard } from "./cards.ts";

function projectAttrs(project: Project): EventAttrs {
  return {
    status: project.status,
    horizon: project.horizon,
    ...(project.repo === null ? {} : { repo: project.repo }),
  };
}

function milestoneAttrs(milestone: Milestone): EventAttrs {
  return { status: milestone.status, horizon: milestone.horizon };
}

export const projectOps = [
  bind(contracts.projectCreate, (ctx, input) => {
    const key = assertProjectKey(input.key);
    if (getProject(ctx, key) !== null) throw new OctoError("conflict", `Project ${key} already exists`);
    ctx.sql.run(
      `INSERT INTO projects (ref, name, description, status, repo, horizon, targetDate, version, createdAt, updatedAt, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        key,
        input.name,
        input.description ?? "",
        input.status ?? "active",
        input.repo ?? null,
        input.horizon ?? "none",
        input.targetDate ?? null,
        ctx.now,
        ctx.now,
        ctx.actor,
      ],
    );
    const project = requireProject(ctx, key);
    emit(ctx, {
      type: "project.created",
      kind: "project",
      ref: key,
      project: key,
      summary: `Project ${key} created: ${input.name}`,
      attrs: projectAttrs(project),
    });
    return project;
  }),

  bind(contracts.projectUpdate, (ctx, input) => {
    const current = requireProject(ctx, input.ref);
    assertVersion(current.ref, current.version, input.ifVersion);
    const changes = applyPatch(ctx, "projects", current.ref, current, {
      name: input.name,
      description: input.description,
      status: input.status,
      repo: input.repo,
      horizon: input.horizon,
      targetDate: input.targetDate,
    });
    const updated = requireProject(ctx, current.ref);
    const fields = Object.keys(changes);
    if (fields.length > 0) {
      const statusChange = changes.status;
      emit(ctx, {
        type: statusChange ? "project.status_changed" : "project.updated",
        kind: "project",
        ref: current.ref,
        project: current.ref,
        summary: statusChange
          ? `Project ${current.ref} is now ${updated.status}`
          : `Project ${current.ref} updated: ${fields.join(", ")}`,
        attrs: projectAttrs(updated),
        changes,
      });
    }
    return updated;
  }),

  bind(contracts.projectList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, ProjectRow, "SELECT * FROM projects ORDER BY ref").map((value) => ({
      kind: "project" as const,
      value,
    }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => buildProjectCard(ctx, entity.value, graph));
  }),

  bind(contracts.milestoneCreate, (ctx, input) => {
    const project = requireProject(ctx, input.project);
    const ref = `M-${nextNumber(ctx, "milestone")}`;
    ctx.sql.run(
      `INSERT INTO milestones (ref, project, title, description, status, horizon, targetDate, version, createdAt, updatedAt, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        ref,
        project.ref,
        input.title,
        input.description ?? "",
        input.status ?? "planned",
        input.horizon ?? "none",
        input.targetDate ?? null,
        ctx.now,
        ctx.now,
        ctx.actor,
      ],
    );
    const milestone = requireMilestone(ctx, ref);
    emit(ctx, {
      type: "milestone.created",
      kind: "milestone",
      ref,
      project: project.ref,
      summary: `Milestone ${ref} created: ${input.title}`,
      attrs: milestoneAttrs(milestone),
    });
    return milestone;
  }),

  bind(contracts.milestoneUpdate, (ctx, input) => {
    const current = requireMilestone(ctx, input.ref);
    assertVersion(current.ref, current.version, input.ifVersion);
    const changes = applyPatch(ctx, "milestones", current.ref, current, {
      title: input.title,
      description: input.description,
      status: input.status,
      horizon: input.horizon,
      targetDate: input.targetDate,
    });
    const updated = getMilestone(ctx, current.ref) ?? current;
    const fields = Object.keys(changes);
    if (fields.length > 0) {
      emit(ctx, {
        type: changes.status ? "milestone.status_changed" : "milestone.updated",
        kind: "milestone",
        ref: current.ref,
        project: current.project,
        summary: changes.status
          ? `Milestone ${current.ref} is now ${updated.status}`
          : `Milestone ${current.ref} updated: ${fields.join(", ")}`,
        attrs: milestoneAttrs(updated),
        changes,
      });
    }
    return updated;
  }),

  bind(contracts.milestoneList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(
      ctx,
      MilestoneRow,
      "SELECT * FROM milestones ORDER BY COALESCE(targetDate, '9999'), ref",
    ).map((value) => ({ kind: "milestone" as const, value }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),
];
