import { agentState } from "../agents/state.ts";
import type { Agent, AgentBrief, AgentView, LineClaim, Notice, NoticeKind } from "../schemas.ts";
import type { Ctx } from "./context.ts";
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

export function viewOf(ctx: Ctx, agent: Agent): AgentView {
  const claim = claimOf(ctx, agent.name);
  return {
    ...agent,
    state: agentState(agent, ctx.now),
    line: claim?.line ?? null,
    role: claim?.role ?? null,
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
