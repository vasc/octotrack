import { OctoError, notFound } from "../errors.ts";
import { normalizeRef } from "../refs.ts";
import type { Drift, FeedEvent } from "../schemas.ts";
import { emit, nextNumber } from "../store/common.ts";
import { type Ctx, one, placeholders, rows } from "../store/context.ts";
import { type AnyEntity, findEntity, getDrift, getIssue, summarize } from "../store/entities.ts";
import { type GraphSnapshot, loadGraph } from "../store/graph.ts";
import { CountRow, DriftRow, EventRow } from "../store/rows.ts";
import { type DesiredDrift, DRIFT_REF, evaluateLevelRules } from "./rules.ts";

/** Changing only these does not make anything derived from an item out of date. */
const NOT_MEANINGFUL: ReadonlySet<string> = new Set([
  "assignee",
  "labels",
  "priority",
  "checks",
  "review",
  "mergeable",
  "headSha",
  "additions",
  "deletions",
  "syncedAt",
]);

/** What a decision can do that everything depending on it must hear about. */
const DECISION_OUTCOME_EVENTS: ReadonlySet<string> = new Set([
  "decision.resolved",
  "decision.changed",
  "decision.reopened",
  "decision.superseded",
]);

function projectOf(entity: AnyEntity | null): string | null {
  return entity === null ? null : summarize(entity).project;
}

function assigneeFor(ctx: Ctx, target: AnyEntity | null, graph: GraphSnapshot): string | null {
  if (target === null) return null;
  switch (target.kind) {
    case "issue":
      return target.value.assignee;
    case "decision":
      return target.value.requestedBy;
    case "pr": {
      const [issueRef] = graph.from(target.value.ref, "implements");
      const issue = issueRef === undefined ? null : getIssue(ctx, issueRef);
      return issue?.assignee ?? null;
    }
    default:
      return null;
  }
}

function openDrift(
  ctx: Ctx,
  desired: DesiredDrift,
  edge: boolean,
  viaLink: boolean,
  graph: GraphSnapshot,
): void {
  const target = findEntity(ctx, desired.target);
  const position = nextNumber(ctx, "drift");
  const ref = `DR-${position}`;
  const assignee = assigneeFor(ctx, target, graph);
  ctx.sql.run(
    `INSERT INTO drifts (ref, rule, dedupeKey, fingerprint, edge, target, cause, viaLink, project, message,
       suggestion, status, assignee, baselineAt, version, createdAt, updatedAt, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, 1, ?, ?, ?)`,
    [
      ref,
      desired.rule,
      desired.dedupeKey,
      desired.fingerprint,
      edge ? 1 : 0,
      desired.target,
      desired.cause,
      viaLink ? 1 : 0,
      desired.project,
      desired.message,
      desired.suggestion.replaceAll(DRIFT_REF, ref),
      assignee,
      ctx.now,
      ctx.now,
      ctx.now,
      position,
    ],
  );
  emit(ctx, {
    type: "drift.opened",
    kind: "drift",
    ref,
    project: desired.project,
    summary: desired.message,
    related: desired.cause === null ? [desired.target] : [desired.target, desired.cause],
    attrs: {
      status: "open",
      rule: desired.rule,
      target: desired.target,
      ...(assignee === null ? {} : { assignee }),
    },
  });
  const created = getDrift(ctx, ref);
  if (created !== null) ctx.openedDrift.push(created);
}

function closeDrift(
  ctx: Ctx,
  drift: Drift,
  status: "updated" | "verified" | "auto_resolved",
  note: string | null,
): void {
  ctx.sql.run(
    `UPDATE drifts SET status = ?, note = ?, resolvedBy = ?, resolvedAt = ?, updatedAt = ?, version = version + 1
     WHERE ref = ?`,
    [status, note, ctx.actor, ctx.now, ctx.now, drift.ref],
  );
  emit(ctx, {
    type: "drift.resolved",
    kind: "drift",
    ref: drift.ref,
    project: drift.project,
    summary:
      status === "auto_resolved"
        ? `Resolved on its own: ${drift.message}`
        : `${status === "verified" ? "Verified, nothing to update" : "Updated"}: ${drift.message}${
            note === null ? "" : ` (${note})`
          }`,
    related: drift.cause === null ? [drift.target] : [drift.target, drift.cause],
    attrs: { status, rule: drift.rule, target: drift.target },
  });
}

function latestForKey(ctx: Ctx, key: string): Drift | null {
  return one(ctx, DriftRow, "SELECT * FROM drifts WHERE dedupeKey = ? ORDER BY position DESC LIMIT 1", [key]);
}

function reconcileLevel(ctx: Ctx, graph: GraphSnapshot): void {
  const desired = evaluateLevelRules(ctx, graph);
  const desiredKeys = new Set(desired.map((item) => item.dedupeKey));
  const open = rows(ctx, DriftRow, "SELECT * FROM drifts WHERE status = 'open' AND edge = 0");
  for (const drift of open) {
    if (!desiredKeys.has(drift.dedupeKey)) closeDrift(ctx, drift, "auto_resolved", null);
  }
  for (const item of desired) {
    const latest = latestForKey(ctx, item.dedupeKey);
    if (latest === null || latest.status === "auto_resolved") {
      openDrift(ctx, item, false, false, graph);
      continue;
    }
    if (latest.status === "open") {
      if (latest.message !== item.message || latest.fingerprint !== item.fingerprint) {
        ctx.sql.run(
          "UPDATE drifts SET message = ?, fingerprint = ?, suggestion = ?, updatedAt = ? WHERE ref = ?",
          [
            item.message,
            item.fingerprint,
            item.suggestion.replaceAll(DRIFT_REF, latest.ref),
            ctx.now,
            latest.ref,
          ],
        );
      }
      continue;
    }
    if (latest.fingerprint !== item.fingerprint) openDrift(ctx, item, false, false, graph);
  }
}

function openEdge(ctx: Ctx, item: DesiredDrift, viaLink: boolean, graph: GraphSnapshot): void {
  const latest = latestForKey(ctx, item.dedupeKey);
  if (latest?.status === "open") {
    // Still open, but what it says must follow: an outcome that changed again would otherwise be applied wrongly.
    // What it reports changed, so an update made before this no longer answers it.
    ctx.sql.run(
      "UPDATE drifts SET message = ?, fingerprint = ?, baselineAt = ?, updatedAt = ? WHERE ref = ?",
      [item.message, item.fingerprint, ctx.now, ctx.now, latest.ref],
    );
    return;
  }
  openDrift(ctx, item, true, viaLink, graph);
}

function decisionEdges(ctx: Ctx, event: FeedEvent, graph: GraphSnapshot): void {
  if (!DECISION_OUTCOME_EVENTS.has(event.type)) return;
  const linked = [...graph.from(event.ref, "affects"), ...graph.blocking(event.ref)];
  for (const target of new Set(linked)) {
    const targetEntity = findEntity(ctx, target);
    if (targetEntity === null) continue;
    const closedIssue =
      targetEntity.kind === "issue" &&
      (targetEntity.value.status === "done" || targetEntity.value.status === "cancelled");
    if (closedIssue) continue;
    openEdge(
      ctx,
      {
        rule: "decision-outcome",
        dedupeKey: `decision-outcome:${target}:${event.ref}`,
        fingerprint: String(event.seq),
        target,
        cause: event.ref,
        project: event.project,
        message: `Check that ${target} reflects this: ${event.summary}`,
        suggestion: `Update ${target}, then: octo drift ack ${DRIFT_REF} --updated "what changed". Or: octo drift ack ${DRIFT_REF} --verified "why nothing needs updating"`,
      },
      true,
      graph,
    );
  }
  if (event.project !== null) {
    openEdge(
      ctx,
      {
        rule: "decision-project-sync",
        dedupeKey: `decision-project-sync:${event.project}:${event.ref}`,
        fingerprint: String(event.seq),
        target: event.project,
        cause: event.ref,
        project: event.project,
        message: `Check that project ${event.project} still describes reality: ${event.summary}`,
        suggestion: `octo project update ${event.project} ..., then: octo drift ack ${DRIFT_REF} --updated "what changed". Or: octo drift ack ${DRIFT_REF} --verified "why nothing needs updating"`,
      },
      false,
      graph,
    );
  }
}

function dependencyEdges(ctx: Ctx, event: FeedEvent, graph: GraphSnapshot): void {
  const meaningful = Object.keys(event.changes).some((key) => !NOT_MEANINGFUL.has(key));
  if (!meaningful) return;
  // A PR seen for the first time has not changed from anything that could have been relied on.
  if (event.kind === "pr" && event.changes.state?.from === null) return;
  for (const target of graph.to(event.ref, "derived_from")) {
    openEdge(
      ctx,
      {
        rule: "dependency-changed",
        dedupeKey: `dependency-changed:${target}:${event.ref}`,
        fingerprint: String(event.seq),
        target,
        cause: event.ref,
        project: projectOf(findEntity(ctx, target)),
        message: `${event.ref}, which ${target} is derived from, changed: check that ${target} is still correct. ${event.summary}`,
        suggestion: `Update ${target}, then: octo drift ack ${DRIFT_REF} --updated "what changed". Or: octo drift ack ${DRIFT_REF} --verified "why nothing needs updating"`,
      },
      true,
      graph,
    );
  }
}

/** A link-derived drift no longer applies once the link has been removed. */
function reconcileRemovedLinks(ctx: Ctx, graph: GraphSnapshot): void {
  const open = rows(ctx, DriftRow, "SELECT * FROM drifts WHERE status = 'open' AND edge = 1 AND viaLink = 1");
  for (const drift of open) {
    if (drift.cause === null) continue;
    if (!graph.neighbours(drift.cause).has(drift.target)) closeDrift(ctx, drift, "auto_resolved", null);
  }
}

/** Called at the end of every write transaction, with the cursor from before the write began. */
export function reconcileDrift(ctx: Ctx, sinceSeq: number): void {
  const graph = loadGraph(ctx);
  const events = rows(
    ctx,
    EventRow,
    "SELECT * FROM events WHERE seq > ? AND kind NOT IN ('drift', 'update') ORDER BY seq ASC",
    [sinceSeq],
  );
  for (const event of events) {
    if (event.kind === "decision") decisionEdges(ctx, event, graph);
    dependencyEdges(ctx, event, graph);
  }
  reconcileRemovedLinks(ctx, graph);
  reconcileLevel(ctx, graph);
}

/** Whether the target really changed since the drift opened. A new label does not make a stale description true. */
function updateWasMade(ctx: Ctx, drift: Drift): boolean {
  const posted = one(ctx, CountRow, "SELECT COUNT(*) AS n FROM updates WHERE target = ? AND createdAt >= ?", [
    drift.target,
    drift.baselineAt,
  ]);
  if ((posted?.n ?? 0) > 0) return true;
  const events = rows(ctx, EventRow, "SELECT * FROM events WHERE ref = ? AND ts >= ?", [
    drift.target,
    drift.baselineAt,
  ]);
  // Claiming starts work on something. It does not make it true.
  return events
    .filter((event) => event.type !== "issue.claimed" && event.type !== "issue.released")
    .some((event) => Object.keys(event.changes).some((key) => !NOT_MEANINGFUL.has(key)));
}

export interface AckInput {
  refs?: readonly string[];
  target?: string;
  mode: "updated" | "verified";
  note: string;
  force?: boolean;
}

export function ackDrift(ctx: Ctx, input: AckInput): Drift[] {
  const drifts: Drift[] = [];
  for (const raw of input.refs ?? []) {
    const ref = normalizeRef(raw);
    const drift = getDrift(ctx, ref);
    if (drift === null) throw notFound(raw);
    drifts.push(drift);
  }
  if (input.target !== undefined) {
    const entity = findEntity(ctx, input.target);
    if (entity === null) throw notFound(input.target);
    drifts.push(
      ...rows(ctx, DriftRow, "SELECT * FROM drifts WHERE target = ? AND status = 'open'", [entity.value.ref]),
    );
  }
  if (input.refs === undefined && input.target === undefined) {
    throw new OctoError(
      "invalid_input",
      "Say which drift to acknowledge",
      "Pass drift refs or --target <ref>.",
    );
  }
  const unique = [...new Map(drifts.map((drift) => [drift.ref, drift])).values()];
  const pending = unique.filter((drift) => drift.status === "open");
  for (const drift of pending) {
    if (drift.claimedBy !== null && drift.claimedBy !== ctx.actor && input.force !== true) {
      throw new OctoError(
        "conflict",
        `${drift.ref} is claimed by ${drift.claimedBy}`,
        "Leave it to them, or pass --force if they have gone away.",
      );
    }
  }
  if (input.mode === "updated") {
    for (const drift of pending) {
      if (!drift.edge) {
        // A level rule closes by itself the moment the state is right, so an open one means that it is still wrong.
        throw new OctoError(
          "conflict",
          `${drift.ref} cannot be marked updated: it is still true that ${drift.message}`,
          "Fix it and this clears by itself, or use --verified if it is correct as it is.",
        );
      }
      if (!updateWasMade(ctx, drift)) {
        throw new OctoError(
          "conflict",
          `${drift.ref} cannot be marked updated: ${drift.target} has not changed since this drift opened`,
          `Make the change first, post an update on it, or use --verified if nothing needs to change.`,
        );
      }
    }
  }
  for (const drift of pending) closeDrift(ctx, drift, input.mode, input.note);
  if (pending.length === 0) return [];
  return rows(
    ctx,
    DriftRow,
    `SELECT * FROM drifts WHERE ref IN (${placeholders(pending)})`,
    pending.map((drift) => drift.ref),
  );
}
