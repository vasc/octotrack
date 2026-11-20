import { OctoError } from "../errors.ts";
import { agentState } from "../agents/state.ts";
import { AgentView } from "../schemas.ts";
import type { Agent, AgentBrief, LineClaim, Notice, NoticeKind } from "../schemas.ts";
import type { Ctx } from "./context.ts";
import { z } from "zod";
import { one, rows } from "./context.ts";
import { AgentRow, ClaimRow, NoticeRow } from "./rows.ts";

export function getAgent(ctx: Ctx, name: string): Agent | null {
  return one(ctx, AgentRow, "SELECT * FROM agents WHERE name = ?", [name]);
}

/** Every line an agent is on, longest-standing first. */
export function claimsOf(ctx: Ctx, agent: string): LineClaim[] {
  return rows(ctx, ClaimRow, "SELECT * FROM line_claims WHERE agent = ? ORDER BY since, line", [agent]);
}

/** An agent's claim on one line, if it is on it. */
export function claimOn(ctx: Ctx, agent: string, line: string): LineClaim | null {
  return one(ctx, ClaimRow, "SELECT * FROM line_claims WHERE agent = ? AND line = ?", [agent, line]);
}

/**
 * The line a write by this agent is about when it names none: its only line, or none when it is on none. On several
 * it must say which, since any guess could put the work on the wrong line.
 */
export function onlyLineOf(ctx: Ctx, agent: string, what: string): string | null {
  const claims = claimsOf(ctx, agent);
  if (claims.length <= 1) return claims[0]?.line ?? null;
  const lines = claims.map((claim) => claim.line);
  throw new OctoError(
    "invalid_input",
    `You are on ${lines.slice(0, -1).join(", ")} and ${lines.at(-1) ?? ""}: say which line ${what}`,
    "Pass --line <REF>.",
  );
}

/** Who is on a line, longest-standing first, which is also who a helper promotion picks. */
export function claimsOn(ctx: Ctx, line: string): LineClaim[] {
  return rows(ctx, ClaimRow, "SELECT * FROM line_claims WHERE line = ? ORDER BY since, agent", [line]);
}

export function briefOf(ctx: Ctx, name: string): AgentBrief {
  const agent = getAgent(ctx, name);
  return { name, state: agent === null ? "gone" : agentState(agent, ctx.now) };
}

const RefRow = z.object({ ref: z.string() });
const StartView = AgentView.shape.start.unwrap();

export function viewOf(ctx: Ctx, agent: Agent): AgentView {
  const claims = claimsOf(ctx, agent.name);
  const last =
    claims.length === 0
      ? (one(ctx, RefRow, "SELECT ref FROM lines WHERE lastOwner = ? ORDER BY updatedAt DESC LIMIT 1", [
          agent.name,
        ])?.ref ?? null)
      : null;
  // Its latest start, if it has run no command since: the roster says it was started for that line, and how it went.
  const start =
    agent.startedBy === "octotrack"
      ? (one(
          ctx,
          StartView,
          `SELECT s.line, s.state, s.attempts, s.exitCode,
                  (SELECT MIN(f.startedAt) FROM runner_starts f WHERE f.line = s.line AND f.name = s.name) AS since
             FROM runner_starts s
            WHERE s.name = ? AND s.startedAt >= ?
            ORDER BY s.id DESC LIMIT 1`,
          [agent.name, agent.lastSeenAt],
        ) ?? null)
      : null;
  return {
    ...agent,
    state: agentState(agent, ctx.now),
    lines: claims.map((claim) => ({ line: claim.line, role: claim.role })),
    lastLine: last,
    start,
  };
}

export function addNotice(
  ctx: Ctx,
  agent: string,
  kind: NoticeKind,
  line: string | null,
  body: string,
  wakes: boolean,
): void {
  ctx.sql.run("INSERT INTO notices (agent, kind, line, body, wakes, createdAt) VALUES (?, ?, ?, ?, ?, ?)", [
    agent,
    kind,
    line,
    body,
    wakes ? 1 : 0,
    ctx.now,
  ]);
}

/** Hands over the agent's undelivered notices, once: a notice is delivered by the reply that carries it. */
export function takeNotices(ctx: Ctx, agent: string): Notice[] {
  const pending = rows(
    ctx,
    NoticeRow,
    "SELECT * FROM notices WHERE agent = ? AND deliveredAt IS NULL ORDER BY id",
    [agent],
  );
  if (pending.length > 0) {
    ctx.sql.run("UPDATE notices SET deliveredAt = ? WHERE agent = ? AND deliveredAt IS NULL", [
      ctx.now,
      agent,
    ]);
  }
  return pending;
}
