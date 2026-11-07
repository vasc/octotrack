import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { EventAttrs, Idea } from "../schemas.ts";
import { applyPatch, assertVersion, emit, nextNumber } from "../store/common.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { requireIdea, requireMilestone, requireProject } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { IdeaRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { createIssue } from "./issues.ts";
import { addLink } from "./links.ts";

function ideaAttrs(idea: Idea): EventAttrs {
  return { status: idea.status, horizon: idea.horizon, label: idea.labels };
}

export const ideaOps = [
  bind(contracts.ideaCapture, (ctx, input) => {
    const project = input.project === undefined ? null : requireProject(ctx, input.project).ref;
    const ref = `I-${nextNumber(ctx, "idea")}`;
    ctx.sql.run(
      `INSERT INTO ideas (ref, project, title, body, status, horizon, labels, version, createdAt, updatedAt, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        ref,
        project,
        input.title,
        input.body ?? "",
        input.status ?? "captured",
        input.horizon ?? "none",
        JSON.stringify(input.labels ?? []),
        ctx.now,
        ctx.now,
        ctx.actor,
      ],
    );
    const idea = requireIdea(ctx, ref);
    emit(ctx, {
      type: "idea.captured",
      kind: "idea",
      ref,
      project,
      summary: `${ref} captured: ${input.title}`,
      attrs: ideaAttrs(idea),
    });
    return idea;
  }),

  bind(contracts.ideaUpdate, (ctx, input) => {
    const current = requireIdea(ctx, input.ref);
    assertVersion(current.ref, current.version, input.ifVersion);
    const changes = applyPatch(ctx, "ideas", current.ref, current, {
      title: input.title,
      body: input.body,
      project:
        input.project === undefined || input.project === null
          ? input.project
          : requireProject(ctx, input.project).ref,
      status: input.status,
      horizon: input.horizon,
      labels: input.labels,
    });
    const updated = requireIdea(ctx, current.ref);
    const fields = Object.keys(changes);
    if (fields.length > 0) {
      emit(ctx, {
        type: changes.status ? "idea.status_changed" : "idea.updated",
        kind: "idea",
        ref: updated.ref,
        project: updated.project,
        summary: changes.status
          ? `${updated.ref} is now ${updated.status}: ${updated.title}`
          : `${updated.ref} updated (${fields.join(", ")}): ${updated.title}`,
        attrs: ideaAttrs(updated),
        changes,
      });
    }
    return updated;
  }),

  bind(contracts.ideaPromote, (ctx, input) => {
    const current = requireIdea(ctx, input.ref);
    if (current.status === "promoted") {
      throw new OctoError(
        "conflict",
        `${current.ref} was already promoted to ${current.promotedTo ?? "something"}`,
      );
    }
    const projectKey = input.project ?? current.project;
    if (projectKey === null) {
      throw new OctoError("invalid_input", `${current.ref} has no project`, "Pass --project <KEY>.");
    }
    const project = requireProject(ctx, projectKey);
    let created: string;
    if (input.as === "milestone") {
      created = `M-${nextNumber(ctx, "milestone")}`;
      ctx.sql.run(
        `INSERT INTO milestones (ref, project, title, description, status, horizon, targetDate, version, createdAt, updatedAt, createdBy)
         VALUES (?, ?, ?, ?, 'planned', ?, NULL, 1, ?, ?, ?)`,
        [created, project.ref, current.title, current.body, current.horizon, ctx.now, ctx.now, ctx.actor],
      );
      const milestone = requireMilestone(ctx, created);
      emit(ctx, {
        type: "milestone.created",
        kind: "milestone",
        ref: created,
        project: project.ref,
        summary: `Milestone ${created} created from ${current.ref}: ${milestone.title}`,
        attrs: { status: milestone.status, horizon: milestone.horizon },
        related: [current.ref],
      });
    } else {
      created = createIssue(ctx, {
        project: project.ref,
        title: current.title,
        body: current.body,
        labels: current.labels,
        priority: input.priority,
      }).ref;
    }
    const changes = applyPatch(ctx, "ideas", current.ref, current, {
      status: "promoted",
      promotedTo: created,
      project: project.ref,
    });
    addLink(ctx, current.ref, "promoted_to", created);
    const idea = requireIdea(ctx, current.ref);
    emit(ctx, {
      type: "idea.promoted",
      kind: "idea",
      ref: idea.ref,
      project: project.ref,
      summary: `${idea.ref} promoted to ${created}: ${idea.title}`,
      related: [created],
      attrs: ideaAttrs(idea),
      changes,
    });
    return { idea, created };
  }),

  bind(contracts.ideaList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, IdeaRow, "SELECT * FROM ideas ORDER BY updatedAt DESC").map((value) => ({
      kind: "idea" as const,
      value,
    }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),
];
