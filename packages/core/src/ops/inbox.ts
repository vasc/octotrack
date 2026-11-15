import { z } from "zod";
import { endClaim, endFirstOffer } from "../agents/claims.ts";
import { agentState } from "../agents/state.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { AgentWake } from "../schemas.ts";
import { claimOf, getAgent, viewOf } from "../store/agents.ts";
import { emit } from "../store/common.ts";
import { rows } from "../store/context.ts";
import { requireIssue, requireLine } from "../store/entities.ts";
import { addToInbox, inboxFor, recipientOf } from "../store/inbox.ts";
import { AgentRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireDeveloper, requireServer } from "./developer.ts";

const CountRow = z.object({ n: z.number() });

export const inboxOps = [
  bind(contracts.lineTell, (ctx, input) => {
    requireDeveloper(ctx, "tell a line");
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
      AgentRow,
      "SELECT * FROM agents WHERE wakeAddress IS NOT NULL AND stoppedAt IS NULL AND goneAt IS NULL",
    ).flatMap((agent): AgentWake[] => {
      if (agent.wakeAddress === null || agentState(agent, ctx.now) !== "asleep") return [];
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
      ctx.sql.run("UPDATE agents SET wakePid = NULL WHERE name = ?", [agent.name]);
      // Killed at its deadline, the wake had reached its session, which was at work: the session is not gone, and
      // keeps its line asleep, to be woken again (fourth audit, A1). Only a wake that could not reach it is a failure.
      if (input.ended === "deadline") {
        const line = claimOf(ctx, agent.name)?.line ?? null;
        emit(ctx, {
          type: "agent.wake_ended",
          kind: "agent",
          ref: agent.name,
          project: agent.repo,
          line,
          summary: `${agent.name}'s wake ran past its deadline, so its process was ended. ${line === null ? "It" : `It keeps ${line}, and`} is woken again when something waits for it.`,
          attrs: {},
        });
      }
    } else if (input.error !== undefined && agent.stoppedAt !== null) {
      // Its wake ended because the developer stopped it, which ended its claims already: nothing failed.
      ctx.sql.run("UPDATE agents SET wakePid = NULL WHERE name = ?", [agent.name]);
    } else {
      ctx.sql.run("UPDATE agents SET wokenAt = ?, wakeError = ?, wakePid = NULL WHERE name = ?", [
        ctx.now,
        input.error ?? null,
        agent.name,
      ]);
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
