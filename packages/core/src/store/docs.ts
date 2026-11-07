import { type MatchEnv, matchQuery, type QueryDoc, type QueryNode } from "../query/index.ts";
import { parseQuery } from "../query/parser.ts";
import type { EntityKind, EntitySummary, FeedEvent, Issue } from "../schemas.ts";
import { type Ctx, rows } from "./context.ts";
import { type AnyEntity, summarize } from "./entities.ts";
import { type GraphSnapshot, loadGraph } from "./graph.ts";
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

export function matchEnv(ctx: Ctx, graph: GraphSnapshot): MatchEnv {
  return { now: ctx.now, linkedRefs: (ref) => graph.neighbours(ref) };
}

type FieldMap = Record<string, readonly string[]>;

function present(value: string | null | undefined): readonly string[] {
  return value === null || value === undefined ? [] : [value];
}

/** True for an issue that could be picked up right now. */
export function isReady(issue: Issue, graph: GraphSnapshot): boolean {
  return issue.status === "todo" && issue.assignee === null && graph.openBlockersOf(issue.ref).length === 0;
}

function issueFields(issue: Issue, graph: GraphSnapshot): FieldMap {
  return {
    status: [issue.status],
    project: [issue.project],
    priority: [issue.priority],
    assignee: present(issue.assignee),
    actor: [issue.createdBy],
    label: issue.labels,
    milestone: present(issue.milestone),
    blocked: [String(graph.openBlockersOf(issue.ref).length > 0 || issue.status === "blocked")],
    ready: [String(isReady(issue, graph))],
  };
}

export function entityDoc(entity: AnyEntity, graph: GraphSnapshot): QueryDoc {
  const base = { ref: entity.value.ref, time: entity.value.updatedAt };
  const withKind = (fields: FieldMap, text: string): QueryDoc => ({
    ...base,
    text,
    fields: {
      kind: [entity.kind],
      ref:
        entity.kind === "pr"
          ? [entity.value.ref, `${entity.value.repo}#${entity.value.number}`]
          : [entity.value.ref],
      ...fields,
    },
  });
  switch (entity.kind) {
    case "project":
      return withKind(
        {
          status: [entity.value.status],
          project: [entity.value.ref],
          repo: present(entity.value.repo),
          horizon: [entity.value.horizon],
          actor: [entity.value.createdBy],
        },
        `${entity.value.name} ${entity.value.description}`,
      );
    case "issue":
      return withKind(issueFields(entity.value, graph), `${entity.value.title} ${entity.value.body}`);
    case "decision":
      return withKind(
        {
          status: [entity.value.status],
          project: present(entity.value.project),
          priority: [entity.value.priority],
          type: [entity.value.kind],
          actor: [entity.value.requestedBy],
          assignee: [entity.value.requestedBy],
          channel: present(entity.value.channel),
        },
        `${entity.value.title} ${entity.value.context} ${entity.value.resolutionNote ?? ""}`,
      );
    case "pr":
      return withKind(
        {
          status: [entity.value.state],
          state: [entity.value.state],
          project: present(entity.value.project),
          repo: [entity.value.repo],
          checks: [entity.value.checks],
          review: [entity.value.review],
          actor: [entity.value.author],
          assignee: [entity.value.author],
        },
        `${entity.value.title} ${entity.value.headRef} ${entity.value.body}`,
      );
    case "milestone":
      return withKind(
        {
          status: [entity.value.status],
          project: [entity.value.project],
          horizon: [entity.value.horizon],
          actor: [entity.value.createdBy],
        },
        `${entity.value.title} ${entity.value.description}`,
      );
    case "idea":
      return withKind(
        {
          status: [entity.value.status],
          project: present(entity.value.project),
          horizon: [entity.value.horizon],
          label: entity.value.labels,
          actor: [entity.value.createdBy],
        },
        `${entity.value.title} ${entity.value.body}`,
      );
    case "update":
      return withKind(
        {
          status: [entity.value.level],
          level: [entity.value.level],
          project: present(entity.value.project),
          target: present(entity.value.target),
          actor: [entity.value.actor],
        },
        entity.value.body,
      );
    case "drift":
      return withKind(
        {
          status: [entity.value.status],
          project: present(entity.value.project),
          rule: [entity.value.rule],
          target: [entity.value.target],
          assignee: present(entity.value.assignee),
        },
        entity.value.message,
      );
  }
}

export function eventDoc(event: FeedEvent): QueryDoc {
  const changeKeys = Object.keys(event.changes);
  const fields: FieldMap = {
    ...Object.fromEntries(
      Object.entries(event.attrs).map(([key, value]) => [key, typeof value === "string" ? [value] : value]),
    ),
    kind: [event.kind],
    ref: [event.ref, ...event.related, ...aliases(event)],
    project: present(event.project),
    actor: [event.actor],
    event: [event.type],
    changed: changeKeys,
    from: changeKeys.flatMap((key) => stringValues(event.changes[key]?.from)),
    to: changeKeys.flatMap((key) => stringValues(event.changes[key]?.to)),
  };
  return { ref: event.ref, time: event.ts, text: `${event.summary} ${event.ref}`, fields };
}

/** PR events carry `owner/repo#12`, so that `ref:owner/repo#12` means the same in a watch as it does everywhere else. */
function aliases(event: FeedEvent): readonly string[] {
  const alias = event.attrs.alias;
  return typeof alias === "string" ? [alias] : [];
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  return [];
}

/** Which kinds a query can possibly match, so that unrelated tables are not loaded. */
export function kindsInQuery(node: QueryNode): ReadonlySet<EntityKind> | null {
  switch (node.type) {
    case "field":
      if (node.field !== "kind") return null;
      // A glob could match anything, so it cannot narrow down which tables to load.
      if (node.values.some((value) => value.includes("*") || value.includes("?"))) return null;
      return new Set(ALL_KINDS.filter((kind) => node.values.some((value) => value.toLowerCase() === kind)));
    case "and": {
      for (const child of node.children) {
        const kinds = kindsInQuery(child);
        if (kinds !== null) return kinds;
      }
      return null;
    }
    case "or": {
      const merged = new Set<EntityKind>();
      for (const child of node.children) {
        const kinds = kindsInQuery(child);
        if (kinds === null) return null;
        for (const kind of kinds) merged.add(kind);
      }
      return merged;
    }
    default:
      return null;
  }
}

const ALL_KINDS: readonly EntityKind[] = [
  "project",
  "issue",
  "decision",
  "pr",
  "milestone",
  "idea",
  "update",
  "drift",
];

export function loadEntities(ctx: Ctx, kind: EntityKind): AnyEntity[] {
  switch (kind) {
    case "project":
      return rows(ctx, ProjectRow, "SELECT * FROM projects").map((value) => ({ kind, value }));
    case "issue":
      return rows(ctx, IssueRow, "SELECT * FROM issues").map((value) => ({ kind, value }));
    case "decision":
      return rows(ctx, DecisionRow, "SELECT * FROM decisions").map((value) => ({ kind, value }));
    case "pr":
      return rows(ctx, PrRow, "SELECT * FROM prs").map((value) => ({ kind, value }));
    case "milestone":
      return rows(ctx, MilestoneRow, "SELECT * FROM milestones").map((value) => ({ kind, value }));
    case "idea":
      return rows(ctx, IdeaRow, "SELECT * FROM ideas").map((value) => ({ kind, value }));
    case "update":
      return rows(ctx, StatusUpdateRow, "SELECT * FROM updates").map((value) => ({ kind, value }));
    case "drift":
      return rows(ctx, DriftRow, "SELECT * FROM drifts").map((value) => ({ kind, value }));
  }
}

/** Runs a query against current state and returns what matched, most recently updated first. */
export function findEntities(ctx: Ctx, query: string, limit = 200, graph = loadGraph(ctx)): EntitySummary[] {
  const ast = parseQuery(query);
  const env = matchEnv(ctx, graph);
  const kinds = kindsInQuery(ast) ?? new Set(ALL_KINDS);
  const matched: EntitySummary[] = [];
  for (const kind of kinds) {
    for (const entity of loadEntities(ctx, kind)) {
      if (matchQuery(ast, entityDoc(entity, graph), env)) matched.push(summarize(entity));
    }
  }
  matched.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return matched.slice(0, limit);
}

/** Narrows one kind's entities by an optional query. Backs every `*.list` operation. */
export function filterEntities<T extends AnyEntity>(
  ctx: Ctx,
  entities: readonly T[],
  query: string | undefined,
  graph: GraphSnapshot,
): T[] {
  if (query === undefined || query.trim() === "") return [...entities];
  const ast = parseQuery(query);
  const env = matchEnv(ctx, graph);
  return entities.filter((entity) => matchQuery(ast, entityDoc(entity, graph), env));
}
