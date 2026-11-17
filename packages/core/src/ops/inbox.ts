import { z } from "zod";
import { endClaim, endFirstOffer } from "../agents/claims.ts";
import { agentState, wakeRuns } from "../agents/state.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { AgentWake } from "../schemas.ts";
import { addNotice, claimOf, getAgent, viewOf } from "../store/agents.ts";
import { emit } from "../store/common.ts";
import { rows } from "../store/context.ts";
import { requireIssue, requireLine } from "../store/entities.ts";
import { addToInbox, inboxFor, recipientOf } from "../store/inbox.ts";
import { WakeRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireServer } from "./developer.ts";

const CountRow = z.object({ n: z.number() });

/**
 * Whether an agent can be woken now: asleep, with no wake of its own still running (fifth audit, B1). A session whose
 * wake was killed at its deadline after its last command is at work no longer, however recent that command, so it is
 * woken to carry on at once rather than after the running window (fifth audit, B3).
 */
function wakeable(agent: WakeRow, now: string): boolean {
  if (wakeRuns(agent, now)) return false;
  const state = agentState(agent, now);
  if (state === "asleep") return true;
  return (
    state === "running" &&
    agent.wakeEnd === "deadline" &&
    agent.wakeEndedAt !== null &&
    agent.wakeEndedAt >= agent.lastSeenAt
  );
}

export const inboxOps = [
  bind(contracts.lineTell, (ctx, input) => {
    const line = requireLine(ctx, input.line);
    const issue = input.issue === undefined ? null : requireIssue(ctx, input.issue);
    if (issue !== null && issue.line !== line.ref) {
      throw new OctoError("invalid_input", `${issue.ref} is not on ${line.ref}`);
    }
    const about = issue === null ? line.ref : issue.ref;
    const words = input.body.trim();
    const body =
      words === ""
        ? `The developer nudged you about ${about}: look at where it stands.`
        : `The developer says, about ${about}: ${words}`;
    addToInbox(ctx, line.ref, "tell", issue?.ref ?? null, issue?.ref ?? null, body);
    const to = recipientOf(ctx, {
      id: 0,
      line: line.ref,
      kind: "tell",
      ref: null,
      issue: issue?.ref ?? null,
      body,
      createdAt: ctx.now,
    });
    emit(ctx, {
      type: "line.told",
      kind: "line",
      ref: line.ref,
      project: line.repos[0] ?? null,
      line: line.ref,
      summary:
        words === ""
          ? `Nudged ${to ?? "whoever takes"} ${about}`
          : `Told ${to ?? "whoever takes"} ${about}: ${words}`,
      attrs: { channel: ctx.channel, ...(ctx.said === null ? {} : { said: ctx.said }) },
    });
    return { line: line.ref, to };
  }),

  bind(contracts.agentWakes, (ctx) =>
    rows(
      ctx,
      WakeRow,
      "SELECT * FROM agents WHERE wakeAddress IS NOT NULL AND stoppedAt IS NULL AND goneAt IS NULL",
    ).flatMap((agent): AgentWake[] => {
      if (agent.wakeAddress === null || !wakeable(agent, ctx.now)) return [];
      const since = agent.wokenAt ?? "";
      const notices =
        rows(
          ctx,
          CountRow,
          "SELECT COUNT(*) AS n FROM notices WHERE agent = ? AND deliveredAt IS NULL AND wakes = 1 AND createdAt > ?",
          [agent.name, since],
        )[0]?.n ?? 0;
      const items = inboxFor(ctx, agent.name).filter((item) => item.createdAt > since).length;
      const waiting = notices + items;
      if (waiting === 0) return [];
      return [
        {
          agent: agent.name,
          address: agent.wakeAddress,
          message: `Octotrack: ${waiting === 1 ? "1 thing waits" : `${waiting} things wait`} for you. Run any octo command as ${agent.name} to read them.`,
        },
      ];
    }),
  ),

  bind(contracts.agentWaking, (ctx) =>
    rows(
      ctx,
      WakeRow,
      "SELECT * FROM agents WHERE wokenAt IS NOT NULL AND wakeEndedAt IS NULL ORDER BY wokenAt, name",
    ).flatMap((agent) =>
      agent.wokenAt === null || !wakeRuns(agent, ctx.now)
        ? []
        : [
            {
              agent: agent.name,
              pid: agent.wakePid,
              since: agent.wokenAt,
              stopped: agent.stoppedAt !== null,
            },
          ],
    ),
  ),

  bind(contracts.agentWoken, (ctx, input) => {
    requireServer(ctx);
    const agent = getAgent(ctx, input.name);
    if (agent === null) throw new OctoError("not_found", `No agent called ${input.name}`);
    const told = [input.error, input.pid, input.ended].filter((part) => part !== undefined).length;
    if (told > 1) {
      throw new OctoError(
        "invalid_input",
        "Record one thing about a wake at a time: its error, its process, or its end",
      );
    }
    if (input.pid !== undefined) {
      ctx.sql.run("UPDATE agents SET wakePid = ? WHERE name = ?", [input.pid, agent.name]);
    } else if (input.ended !== undefined) {
      ctx.sql.run("UPDATE agents SET wakePid = NULL, wakeEndedAt = ?, wakeEnd = ? WHERE name = ?", [
        ctx.now,
        input.ended,
        agent.name,
      ]);
      const line = claimOf(ctx, agent.name)?.line ?? null;
      // Killed at its deadline, the wake had reached its session, which was at work: the session is not gone, and
      // keeps its line (fourth audit, A1). It is told to carry on, which wakes it again at once (fifth audit, B3).
      if (input.ended === "deadline") {
        addNotice(
          ctx,
          agent.name,
          "wake_deadline",
          line,
          `Your wake ran past its deadline, so its process was ended while you worked. Carry on where you left off${line === null ? "" : ` on ${line}: octo line show ${line}`}.`,
          true,
        );
        emit(ctx, {
          type: "agent.wake_ended",
          kind: "agent",
          ref: agent.name,
          project: agent.repo,
          line,
          summary: `${agent.name}'s wake ran past its deadline, so its process was ended. ${line === null ? "It" : `It keeps ${line}, and`} is woken again to carry on.`,
          attrs: {},
        });
      } else if (input.ended === "stopped") {
        emit(ctx, {
          type: "agent.wake_ended",
          kind: "agent",
          ref: agent.name,
          project: agent.repo,
          line,
          summary: `${agent.name}'s wake was ended, as the developer stopped it`,
          attrs: {},
        });
      }
    } else if (input.error !== undefined && agent.stoppedAt !== null) {
      // Its wake ended because the developer stopped it, which ended its claims already: nothing failed.
      ctx.sql.run("UPDATE agents SET wakePid = NULL, wakeEndedAt = ?, wakeEnd = 'stopped' WHERE name = ?", [
        ctx.now,
        agent.name,
      ]);
    } else if (input.error !== undefined) {
      ctx.sql.run(
        "UPDATE agents SET wokenAt = ?, wakeError = ?, wakePid = NULL, wakeEndedAt = ?, wakeEnd = 'error' WHERE name = ?",
        [ctx.now, input.error, ctx.now, agent.name],
      );
    } else {
      // A wake begins: it runs until its end is recorded.
      ctx.sql.run(
        "UPDATE agents SET wokenAt = ?, wakeError = NULL, wakePid = NULL, wakeEndedAt = NULL, wakeEnd = NULL WHERE name = ?",
        [ctx.now, agent.name],
      );
    }
    if (input.error !== undefined && agent.stoppedAt === null) {
      // A session that cannot be woken is gone: what it held goes to whoever comes next.
      ctx.sql.run("UPDATE agents SET goneAt = ? WHERE name = ?", [ctx.now, agent.name]);
      endFirstOffer(ctx, agent.name);
      const claim = endClaim(ctx, agent.name, "gone");
      emit(ctx, {
        type: "agent.gone",
        kind: "agent",
        ref: agent.name,
        project: agent.repo,
        line: claim?.line ?? null,
        summary: `${agent.name} could not be woken, so it is gone: ${input.error}`,
        attrs: {},
      });
    }
    const updated = getAgent(ctx, agent.name);
    if (updated === null) throw new OctoError("internal", `${agent.name} vanished`);
    return viewOf(ctx, updated);
  }),
];
