import { contracts } from "../contracts.ts";
import { ackDrift } from "../drift/engine.ts";
import { notFound, OctoError } from "../errors.ts";
import { parseQuery, QUERY_FIELDS } from "../query/index.ts";
import { generateRoadmap } from "../roadmap.ts";
import type { Counts, Decision, Drift, Issue } from "../schemas.ts";
import { countOf, emit, nextNumber, currentCursor } from "../store/common.ts";
import { type Ctx, rows } from "../store/context.ts";
import { filterEntities, findEntities, isReady } from "../store/docs.ts";
import {
  findEntity,
  getDrift,
  getUpdate,
  requireEntity,
  requireProject,
  summarize,
} from "../store/entities.ts";
import { normalizeRef } from "../refs.ts";
import { loadGraph, type GraphSnapshot } from "../store/graph.ts";
import {
  AgentRow,
  DecisionRow,
  DriftRow,
  EventRow,
  IssueRow,
  LinkRow,
  PrRow,
  ProjectRow,
  RefRow,
  StatusUpdateRow,
  SyncFailureRow,
  ViewRow,
} from "../store/rows.ts";
import { cancelWatch, checkWatch, createWatch, listWatches } from "../watch/engine.ts";
import { bind } from "./bind.ts";
import { buildIssueCard, buildPrCard, buildProjectCard, comparePrCards } from "./cards.ts";
import { buildQueue } from "./decisions.ts";
import { listFeed } from "./feed.ts";

/** The first view is what the dashboard opens with. */
export const BUILTIN_VIEWS: readonly { name: string; query: string }[] = [
  { name: "Feed", query: "-kind:drift -event:link.*" },
  { name: "Decisions", query: "kind:decision" },
  { name: "Architecture", query: "kind:decision type:architecture" },
  { name: "Product", query: "kind:decision type:product" },
  { name: "Pull requests", query: "kind:pr" },
  { name: "Status updates", query: "kind:update" },
  { name: "Blockers", query: "level:blocker,warning OR checks:failing OR status:blocked" },
  { name: "Drift", query: "kind:drift" },
  { name: "Everything", query: "" },
];

const UPDATE_SUMMARY_LENGTH = 240;

export function seedViews(ctx: Ctx): void {
  BUILTIN_VIEWS.forEach((view, position) => {
    ctx.sql.run(
      "INSERT OR IGNORE INTO views (name, query, position, builtin, createdAt) VALUES (?, ?, ?, 1, ?)",
      [view.name, view.query, position, ctx.now],
    );
  });
}

function assertNotBuiltin(ctx: Ctx, name: string): void {
  const [view] = rows(ctx, ViewRow, "SELECT * FROM views WHERE name = ? COLLATE NOCASE", [name]);
  if (view?.builtin === true) {
    throw new OctoError("conflict", `"${view.name}" is built in`, "Save your filter under another name.");
  }
}

function computeCounts(ctx: Ctx, graph: GraphSnapshot): Counts {
  const blockedLinks = new Set(
    graph.links
      .filter((link) => link.rel === "blocks" && graph.open.has(link.fromRef))
      .map((link) => link.toRef),
  );
  const openIssues = rows(ctx, IssueRow, "SELECT * FROM issues WHERE status NOT IN ('done', 'cancelled')");
  return {
    openDecisions: countOf(ctx, "SELECT COUNT(*) AS n FROM decisions WHERE status = 'open'"),
    openDrift: countOf(ctx, "SELECT COUNT(*) AS n FROM drifts WHERE status = 'open'"),
    openPrs: countOf(ctx, "SELECT COUNT(*) AS n FROM prs WHERE state IN ('open', 'draft')"),
    failingPrs: countOf(
      ctx,
      "SELECT COUNT(*) AS n FROM prs WHERE state IN ('open', 'draft') AND checks = 'failing'",
    ),
    activeIssues: openIssues.filter((issue) => issue.status === "in_progress" || issue.status === "in_review")
      .length,
    blockedIssues: openIssues.filter((issue) => issue.status === "blocked" || blockedLinks.has(issue.ref))
      .length,
    waitingWatches: listWatches(ctx, false, undefined).filter((watch) => watch.waiting).length,
    ideas: countOf(
      ctx,
      "SELECT COUNT(*) AS n FROM ideas WHERE status IN ('captured', 'exploring', 'planned')",
    ),
  };
}

const PRIORITY_RANK: Readonly<Record<Issue["priority"], number>> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function describeNext(
  drift: readonly Drift[],
  resolved: readonly Decision[],
  ready: number,
  claimed: number,
): string {
  const parts: string[] = [];
  if (resolved.length > 0) parts.push(`${resolved.length} of your decisions came back`);
  if (drift.length > 0) parts.push(`${drift.length} drift to clear`);
  if (claimed > 0) parts.push(`${claimed} issues claimed`);
  if (ready > 0) parts.push(`${ready} ready to pick up`);
  return parts.length === 0 ? "Nothing to do." : `${parts.join("; ")}.`;
}

export const miscOps = [
  bind(contracts.updatePost, (ctx, input) => {
    const target = input.target === undefined ? null : requireEntity(ctx, input.target);
    const targetRef = target?.value.ref ?? null;
    const project =
      input.project === undefined
        ? target === null
          ? null
          : summarize(target).project
        : requireProject(ctx, input.project).ref;
    const level = input.level ?? "info";
    const ref = `U-${nextNumber(ctx, "update")}`;
    ctx.sql.run(
      `INSERT INTO updates (ref, target, project, level, body, actor, version, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [ref, targetRef, project, level, input.body, ctx.actor, ctx.now, ctx.now],
    );
    const firstLine = input.body.split("\n")[0] ?? "";
    emit(ctx, {
      type: "status.posted",
      kind: "update",
      ref,
      project,
      summary:
        firstLine.length > UPDATE_SUMMARY_LENGTH
          ? `${firstLine.slice(0, UPDATE_SUMMARY_LENGTH)}...`
          : firstLine,
      related: targetRef === null ? [] : [targetRef],
      attrs: { status: level, level, ...(targetRef === null ? {} : { target: targetRef }) },
    });
    const update = getUpdate(ctx, ref);
    if (update === null) throw new OctoError("internal", `${ref} vanished`);
    return update;
  }),

  bind(contracts.updateList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, StatusUpdateRow, "SELECT * FROM updates ORDER BY createdAt DESC").map((value) => ({
      kind: "update" as const,
      value,
    }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 100)
      .map((entity) => entity.value);
  }),

  bind(contracts.driftList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, DriftRow, "SELECT * FROM drifts ORDER BY position DESC").map((value) => ({
      kind: "drift" as const,
      value,
    }));
    const query = input.query ?? "";
    const scoped = /\bstatus:/.test(query) ? query : `status:open ${query}`;
    return filterEntities(ctx, all, scoped, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),

  bind(contracts.driftAck, (ctx, input) => ({ acknowledged: ackDrift(ctx, input) })),

  // The tracker re-evaluates all rules at the end of every write, so the work happens there.
  bind(contracts.driftClaim, (ctx, input) =>
    input.refs.map((rawRef) => {
      const ref = normalizeRef(rawRef);
      const drift = getDrift(ctx, ref);
      if (drift === null) throw notFound(rawRef);
      if (drift.claimedBy !== null && drift.claimedBy !== ctx.actor && input.force !== true) {
        throw new OctoError(
          "conflict",
          `${ref} belongs to ${drift.claimedBy}`,
          "Pass --force to take it over.",
        );
      }
      ctx.sql.run(
        "UPDATE drifts SET assignee = ?, claimedBy = ?, updatedAt = ?, version = version + 1 WHERE ref = ?",
        [ctx.actor, ctx.actor, ctx.now, ref],
      );
      emit(ctx, {
        type: "drift.claimed",
        kind: "drift",
        ref,
        project: drift.project,
        summary: `${ctx.actor} is handling: ${drift.message}`,
        related: [drift.target],
        attrs: { status: drift.status, rule: drift.rule, target: drift.target, assignee: ctx.actor },
      });
      return { ...drift, assignee: ctx.actor, claimedBy: ctx.actor };
    }),
  ),

  bind(contracts.driftScan, (ctx) => ({
    open: countOf(ctx, "SELECT COUNT(*) AS n FROM drifts WHERE status = 'open'"),
  })),

  bind(contracts.feedList, (ctx, input) => listFeed(ctx, input)),

  bind(contracts.viewSave, (ctx, input) => {
    // A bad query saved under a name would otherwise fail every time it is opened, or the dashboard itself for "Feed".
    parseQuery(input.query);
    assertNotBuiltin(ctx, input.name);
    const position = countOf(ctx, "SELECT COUNT(*) AS n FROM views");
    ctx.sql.run(
      `INSERT INTO views (name, query, position, builtin, createdAt) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(name) DO UPDATE SET query = excluded.query`,
      [input.name, input.query, position, ctx.now],
    );
    const [saved] = rows(ctx, ViewRow, "SELECT * FROM views WHERE name = ?", [input.name]);
    if (saved === undefined) throw new OctoError("internal", "View vanished");
    return saved;
  }),

  bind(contracts.viewList, (ctx) => rows(ctx, ViewRow, "SELECT * FROM views ORDER BY position, name")),

  bind(contracts.viewRemove, (ctx, input) => {
    assertNotBuiltin(ctx, input.name);
    const { changes } = ctx.sql.run("DELETE FROM views WHERE name = ?", [input.name]);
    return { removed: changes > 0 };
  }),

  bind(contracts.watchCreate, (ctx, input) => createWatch(ctx, input)),
  bind(contracts.watchCheck, (ctx, input) => input.refs.map((ref) => checkWatch(ctx, ref))),
  bind(contracts.watchList, (ctx, input) => listWatches(ctx, input.all === true, input.agent)),
  bind(contracts.watchCancel, (ctx, input) => ({
    cancelled: input.refs.map((ref) => cancelWatch(ctx, ref)),
  })),

  bind(contracts.agentList, (ctx) => rows(ctx, AgentRow, "SELECT * FROM agents ORDER BY lastSeenAt DESC")),

  bind(contracts.agentNote, (ctx, input) => {
    ctx.sql.run("UPDATE agents SET note = ? WHERE name = ?", [input.note, ctx.actor]);
    const [agent] = rows(ctx, AgentRow, "SELECT * FROM agents WHERE name = ?", [ctx.actor]);
    if (agent === undefined) throw new OctoError("internal", `Agent ${ctx.actor} is unknown`);
    return agent;
  }),

  bind(contracts.roadmapGenerate, (ctx, input) =>
    generateRoadmap(
      ctx,
      input.project === undefined ? null : requireProject(ctx, input.project).ref,
      loadGraph(ctx),
    ),
  ),

  bind(contracts.next, (ctx, input) => {
    const agent = input.agent ?? ctx.actor;
    const limit = input.limit ?? 10;
    const project = input.project === undefined ? null : requireProject(ctx, input.project).ref;
    const inScope = (itemProject: string | null): boolean => project === null || itemProject === project;
    const graph = loadGraph(ctx);
    const drift = rows(
      ctx,
      DriftRow,
      `SELECT * FROM drifts WHERE status = 'open' AND (assignee = ? OR assignee IS NULL)
       AND (claimedBy IS NULL OR claimedBy = ?) ORDER BY position DESC`,
      [agent, agent],
    )
      .filter((item) => inScope(item.project))
      .slice(0, limit);
    const awaitingDecisions = rows(
      ctx,
      DecisionRow,
      "SELECT * FROM decisions WHERE status = 'open' AND requestedBy = ?",
      [agent],
    ).filter((item) => inScope(item.project));
    const recently = new Date(Date.parse(ctx.now) - 86_400_000).toISOString();
    const resolvedDecisions = rows(
      ctx,
      DecisionRow,
      "SELECT * FROM decisions WHERE status = 'decided' AND requestedBy = ? AND pickedUpAt IS NULL AND updatedAt >= ? ORDER BY updatedAt DESC",
      [agent, recently],
    ).filter((item) => inScope(item.project));
    const claimedIssues = rows(
      ctx,
      IssueRow,
      "SELECT * FROM issues WHERE assignee = ? AND status NOT IN ('done', 'cancelled') ORDER BY updatedAt DESC",
      [agent],
    ).filter((item) => inScope(item.project));
    const claimedRefs = new Set(claimedIssues.map((issue) => issue.ref));
    const prs = rows(ctx, PrRow, "SELECT * FROM prs WHERE state IN ('open', 'draft')")
      .filter((pr) => inScope(pr.project))
      .map((pr) => buildPrCard(ctx, pr, graph))
      .filter(
        (card) =>
          card.attention.length > 0 &&
          (card.pr.author === agent || card.issues.some((issue) => claimedRefs.has(issue))),
      )
      .sort(comparePrCards);
    const ready = rows(ctx, IssueRow, "SELECT * FROM issues WHERE status = 'todo' AND assignee IS NULL")
      .filter((issue) => isReady(issue, graph) && inScope(issue.project))
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt),
      )
      .slice(0, limit);
    return {
      agent,
      drift,
      awaitingDecisions,
      resolvedDecisions,
      claimed: claimedIssues.map((issue) => buildIssueCard(ctx, issue, graph)),
      prs,
      ready: ready.map((issue) => buildIssueCard(ctx, issue, graph)),
      summary: describeNext(drift, resolvedDecisions, ready.length, claimedIssues.length),
    };
  }),

  bind(contracts.entityShow, (ctx, input) => {
    const entity = requireEntity(ctx, input.ref);
    const ref = entity.value.ref;
    const links = rows(ctx, LinkRow, "SELECT * FROM links WHERE fromRef = ? OR toRef = ?", [ref, ref]);
    const linkedRefs = new Set(
      links.flatMap((link) => [link.fromRef, link.toRef]).filter((other) => other !== ref),
    );
    const linked = [...linkedRefs].flatMap((other) => {
      const found = findEntity(ctx, other);
      return found === null ? [] : [summarize(found)];
    });
    return {
      summary: summarize(entity),
      entity: entity.value,
      links,
      linked,
      drift: rows(
        ctx,
        DriftRow,
        "SELECT * FROM drifts WHERE (target = ? OR cause = ?) ORDER BY position DESC LIMIT 50",
        [ref, ref],
      ),
      updates: rows(
        ctx,
        StatusUpdateRow,
        "SELECT * FROM updates WHERE target = ? ORDER BY createdAt DESC LIMIT 50",
        [ref],
      ),
      history: rows(
        ctx,
        EventRow,
        `SELECT e.* FROM events e WHERE e.ref = ? OR EXISTS (SELECT 1 FROM json_each(e.related) WHERE value = ?)
         ORDER BY e.seq DESC LIMIT 100`,
        [ref, ref],
      ),
    };
  }),

  bind(contracts.entityFind, (ctx, input) => findEntities(ctx, input.query ?? "", input.limit ?? 100)),

  bind(contracts.dashboardBootstrap, (ctx, input) => {
    const graph = loadGraph(ctx);
    const openPrs = rows(ctx, PrRow, "SELECT * FROM prs WHERE state IN ('open', 'draft')");
    const recentPrs = rows(
      ctx,
      PrRow,
      "SELECT * FROM prs WHERE state IN ('merged', 'closed') ORDER BY updatedAt DESC LIMIT 5",
    );
    const projects = rows(ctx, ProjectRow, "SELECT * FROM projects ORDER BY ref").map((project) =>
      buildProjectCard(ctx, project, graph),
    );
    return {
      cursor: currentCursor(ctx),
      syncFailures: rows(
        ctx,
        SyncFailureRow,
        `SELECT * FROM github_sync WHERE error IS NOT NULL AND repo IN (SELECT repo FROM projects) ORDER BY repo`,
      ),
      counts: computeCounts(ctx, graph),
      queue: buildQueue(ctx, undefined),
      prs: [...openPrs, ...recentPrs].map((pr) => buildPrCard(ctx, pr, graph)).sort(comparePrCards),
      projects,
      views: rows(ctx, ViewRow, "SELECT * FROM views ORDER BY position, name"),
      watches: listWatches(ctx, false, undefined).filter((watch) => watch.waiting),
      feed: listFeed(ctx, {
        view: input.query === undefined ? (input.view ?? "Feed") : input.view,
        query: input.query,
      }),
      facets: {
        actors: rows(ctx, AgentRow, "SELECT * FROM agents ORDER BY lastSeenAt DESC LIMIT 50").map(
          (agent) => agent.name,
        ),
        labels: [
          ...new Set(
            rows(ctx, IssueRow, "SELECT * FROM issues WHERE labels != '[]'").flatMap((issue) => issue.labels),
          ),
        ].sort(),
        eventTypes: rows(ctx, RefRow, "SELECT DISTINCT type AS ref FROM events ORDER BY type").map(
          (row) => row.ref,
        ),
      },
    };
  }),

  bind(contracts.systemFields, () =>
    QUERY_FIELDS.map((field) => ({ name: field.name, description: field.description })),
  ),
];
