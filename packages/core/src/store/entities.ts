import { notFound } from "../errors.ts";
import { kindOfRef, normalizeRef, parseRepoPrRef } from "../refs.ts";
import type {
  Decision,
  Drift,
  EntityKind,
  EntitySummary,
  Idea,
  Issue,
  Milestone,
  Project,
  PullRequest,
  StatusUpdate,
} from "../schemas.ts";
import { one, type Ctx } from "./context.ts";
import {
  DecisionRow,
  DriftRow,
  IdeaRow,
  IssueRow,
  MilestoneRow,
  PrRow,
  ProjectRow,
  StatusUpdateRow,
} from "./rows.ts";

export type AnyEntity =
  | { kind: "project"; value: Project }
  | { kind: "issue"; value: Issue }
  | { kind: "decision"; value: Decision }
  | { kind: "pr"; value: PullRequest }
  | { kind: "milestone"; value: Milestone }
  | { kind: "idea"; value: Idea }
  | { kind: "update"; value: StatusUpdate }
  | { kind: "drift"; value: Drift };

export function getProject(ctx: Ctx, ref: string): Project | null {
  return one(ctx, ProjectRow, "SELECT * FROM projects WHERE ref = ?", [ref]);
}
export function getIssue(ctx: Ctx, ref: string): Issue | null {
  return one(ctx, IssueRow, "SELECT * FROM issues WHERE ref = ?", [ref]);
}
export function getDecision(ctx: Ctx, ref: string): Decision | null {
  return one(ctx, DecisionRow, "SELECT * FROM decisions WHERE ref = ?", [ref]);
}
export function getPr(ctx: Ctx, ref: string): PullRequest | null {
  return one(ctx, PrRow, "SELECT * FROM prs WHERE ref = ?", [ref]);
}
export function getPrByNumber(ctx: Ctx, repo: string, number: number): PullRequest | null {
  return one(ctx, PrRow, "SELECT * FROM prs WHERE repo = ? AND number = ?", [repo, number]);
}
export function getMilestone(ctx: Ctx, ref: string): Milestone | null {
  return one(ctx, MilestoneRow, "SELECT * FROM milestones WHERE ref = ?", [ref]);
}
export function getIdea(ctx: Ctx, ref: string): Idea | null {
  return one(ctx, IdeaRow, "SELECT * FROM ideas WHERE ref = ?", [ref]);
}
export function getUpdate(ctx: Ctx, ref: string): StatusUpdate | null {
  return one(ctx, StatusUpdateRow, "SELECT * FROM updates WHERE ref = ?", [ref]);
}
export function getDrift(ctx: Ctx, ref: string): Drift | null {
  return one(ctx, DriftRow, "SELECT * FROM drifts WHERE ref = ?", [ref]);
}

function loadByKind(ctx: Ctx, kind: EntityKind, ref: string): AnyEntity | null {
  switch (kind) {
    case "project": {
      const value = getProject(ctx, ref);
      return value && { kind, value };
    }
    case "issue": {
      const value = getIssue(ctx, ref);
      return value && { kind, value };
    }
    case "decision": {
      const value = getDecision(ctx, ref);
      return value && { kind, value };
    }
    case "pr": {
      const value = getPr(ctx, ref);
      return value && { kind, value };
    }
    case "milestone": {
      const value = getMilestone(ctx, ref);
      return value && { kind, value };
    }
    case "idea": {
      const value = getIdea(ctx, ref);
      return value && { kind, value };
    }
    case "update": {
      const value = getUpdate(ctx, ref);
      return value && { kind, value };
    }
    case "drift": {
      const value = getDrift(ctx, ref);
      return value && { kind, value };
    }
  }
}

export function findEntity(ctx: Ctx, rawRef: string): AnyEntity | null {
  const repoPr = parseRepoPrRef(rawRef);
  if (repoPr !== null) {
    const value = getPrByNumber(ctx, repoPr.repo, repoPr.number);
    return value && { kind: "pr", value };
  }
  const ref = normalizeRef(rawRef);
  const kind = kindOfRef(ref);
  return kind === null ? null : loadByKind(ctx, kind, ref);
}

export function requireEntity(ctx: Ctx, rawRef: string): AnyEntity {
  const entity = findEntity(ctx, rawRef);
  if (entity === null) throw notFound(rawRef);
  return entity;
}

/** Accepts every spelling of a ref and returns the canonical one, or throws when nothing exists there. */
export function resolveRef(ctx: Ctx, rawRef: string): string {
  return requireEntity(ctx, rawRef).value.ref;
}

export function requireProject(ctx: Ctx, rawRef: string): Project {
  const value = getProject(ctx, normalizeRef(rawRef));
  if (value === null) throw notFound(rawRef);
  return value;
}
export function requireIssue(ctx: Ctx, rawRef: string): Issue {
  const value = getIssue(ctx, normalizeRef(rawRef));
  if (value === null) throw notFound(rawRef);
  return value;
}
export function requireDecision(ctx: Ctx, rawRef: string): Decision {
  const value = getDecision(ctx, normalizeRef(rawRef));
  if (value === null) throw notFound(rawRef);
  return value;
}
export function requireMilestone(ctx: Ctx, rawRef: string): Milestone {
  const value = getMilestone(ctx, normalizeRef(rawRef));
  if (value === null) throw notFound(rawRef);
  return value;
}
export function requireIdea(ctx: Ctx, rawRef: string): Idea {
  const value = getIdea(ctx, normalizeRef(rawRef));
  if (value === null) throw notFound(rawRef);
  return value;
}

export function summarize(entity: AnyEntity): EntitySummary {
  const base = {
    kind: entity.kind,
    ref: entity.value.ref,
    version: entity.value.version,
    updatedAt: entity.value.updatedAt,
  };
  switch (entity.kind) {
    case "project":
      return {
        ...base,
        title: entity.value.name,
        status: entity.value.status,
        project: entity.value.ref,
        priority: null,
        assignee: null,
      };
    case "issue":
      return {
        ...base,
        title: entity.value.title,
        status: entity.value.status,
        project: entity.value.project,
        priority: entity.value.priority,
        assignee: entity.value.assignee,
      };
    case "decision":
      return {
        ...base,
        title: entity.value.title,
        status: entity.value.status,
        project: entity.value.project,
        priority: entity.value.priority,
        assignee: entity.value.requestedBy,
      };
    case "pr":
      return {
        ...base,
        title: entity.value.title,
        status: entity.value.state,
        project: entity.value.project,
        priority: null,
        assignee: entity.value.author,
      };
    case "milestone":
      return {
        ...base,
        title: entity.value.title,
        status: entity.value.status,
        project: entity.value.project,
        priority: null,
        assignee: null,
      };
    case "idea":
      return {
        ...base,
        title: entity.value.title,
        status: entity.value.status,
        project: entity.value.project,
        priority: null,
        assignee: null,
      };
    case "update":
      return {
        ...base,
        title: entity.value.body.split("\n")[0] ?? "",
        status: entity.value.level,
        project: entity.value.project,
        priority: null,
        assignee: entity.value.actor,
      };
    case "drift":
      return {
        ...base,
        title: entity.value.message,
        status: entity.value.status,
        project: entity.value.project,
        priority: null,
        assignee: entity.value.assignee,
      };
  }
}
