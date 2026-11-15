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

export function claimOf(ctx: Ctx, agent: string): LineClaim | null {
  return one(ctx, ClaimRow, "SELECT * FROM line_claims WHERE agent = ?", [agent]);
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
  const claim = claimOf(ctx, agent.name);
  const last =
    claim === null
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
    line: claim?.line ?? null,
    role: claim?.role ?? null,
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
