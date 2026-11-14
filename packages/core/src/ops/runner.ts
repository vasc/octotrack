import { z } from "zod";
import { endClaim, searchOf, searchStep } from "../agents/claims.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { LineStart, RunnerDue, RunnerStatus } from "../schemas.ts";
import { claimOf, claimsOn, getAgent } from "../store/agents.ts";
import { emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { allLines, requireLine, requireProject } from "../store/entities.ts";
import { bind } from "./bind.ts";
import { requireDeveloper } from "./developer.ts";

const MINUTE_MS = 60_000;
/** A start that fails at once is tried again after these waits, then every six hours. */
const RETRY_WAITS_MS = [2, 10, 60, 360].map((minutes) => minutes * MINUTE_MS);
const OUTPUT_KEPT = 2000;

const StartRow = z.object({
  id: z.number().int(),
  line: z.string(),
  repo: z.string(),
  name: z.string(),
  worktree: z.string().nullable(),
  state: z.enum(["starting", "running", "failed", "never_took", "exited"]),
  output: z.string().nullable(),
  attempts: z.number().int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  nextTryAt: z.string().nullable(),
});
type StartRow = z.infer<typeof StartRow>;
const SettingRow = z.object({ key: z.string(), value: z.string() });
const WorktreeRow = z.object({
  path: z.string(),
  repo: z.string(),
  checkout: z.string(),
  branch: z.string(),
  agent: z.string(),
  removedAt: z.string().nullable(),
});

export function runnerStatus(ctx: Ctx): RunnerStatus {
  const settings = new Map(
    rows(ctx, SettingRow, "SELECT * FROM runner_settings").map((row) => [row.key, row.value]),
  );
  return {
    configured: settings.get("configured") === "true",
    cap: Number(settings.get("cap") ?? "1"),
    dryRun: settings.get("dryRun") !== "false",
  };
}

function latestStart(ctx: Ctx, column: "line" | "name", value: string): StartRow | null {
  return one(ctx, StartRow, `SELECT * FROM runner_starts WHERE ${column} = ? ORDER BY id DESC LIMIT 1`, [
    value,
  ]);
}

export function lineStart(ctx: Ctx, line: string): LineStart | null {
  const start = latestStart(ctx, "line", line);
  return start === null
    ? null
    : {
        name: start.name,
        state: start.state,
        output: start.output,
        attempts: start.attempts,
        at: start.endedAt ?? start.startedAt,
        nextTryAt: start.nextTryAt,
      };
}

/** Sessions Octotrack started that still count against the cap: starting, or alive and not stopped. */
function activeSessions(ctx: Ctx): number {
  return (
    one(
      ctx,
      z.object({ n: z.number() }),
      `SELECT COUNT(*) AS n FROM agents a
       WHERE a.startedBy = 'octotrack' AND a.goneAt IS NULL AND a.stoppedAt IS NULL`,
    )?.n ?? 0
  );
}

/** The repo of the current step's first unclaimed issue, else the line's first-listed repo. */
function repoFor(ctx: Ctx, line: string, repos: readonly string[]): string | null {
  const issue = one(
    ctx,
    z.object({ project: z.string() }),
    `SELECT project FROM issues WHERE line = ? AND assignee IS NULL AND status IN ('todo', 'backlog')
     ORDER BY step IS NULL, step, createdAt LIMIT 1`,
    [line],
  );
  return issue?.project ?? repos[0] ?? null;
}

/** What the runner records comes from the server's own runner, never from an agent: an agent could otherwise end others. */
function requireRunner(ctx: Ctx): void {
  if (!ctx.system) throw new OctoError("forbidden", "Only the server's runner records this");
}

function retryWait(attempts: number): number {
  return RETRY_WAITS_MS[Math.min(attempts - 1, RETRY_WAITS_MS.length - 1)] ?? RETRY_WAITS_MS[0] ?? MINUTE_MS;
}

export const runnerOps = [
  bind(contracts.runnerReport, (ctx, input) => {
    requireRunner(ctx);
    for (const [key, value] of Object.entries(input)) {
      ctx.sql.run(
        "INSERT INTO runner_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, String(value)],
      );
    }
    ctx.visibleChange = true;
    return runnerStatus(ctx);
  }),

  bind(contracts.runnerDue, (ctx) => {
    const status = runnerStatus(ctx);
    if (!status.configured) return [];
    let slots = status.cap - activeSessions(ctx);
    return allLines(ctx, "WHERE state = 'working' AND ownedBy IS NULL").flatMap((line): RunnerDue[] => {
      const search = searchOf(ctx, line.ref);
      if (search === null || searchStep(search, ctx.now) !== 3) return [];
      if (claimsOn(ctx, line.ref).some((claim) => claim.role === "owner")) return [];
      const last = latestStart(ctx, "line", line.ref);
      if (last !== null && (last.state === "starting" || last.state === "never_took")) return [];
      if (last?.state === "failed" && last.nextTryAt !== null && last.nextTryAt > ctx.now) return [];
      const repo = repoFor(ctx, line.ref, line.repos);
      if (repo === null || slots <= 0) return [];
      slots -= 1;
      const retry = last?.state === "failed";
      return [
        { line: line.ref, repo, name: retry ? last.name : null, attempt: retry ? last.attempts + 1 : 1 },
      ];
    });
  }),

  bind(contracts.runnerStart, (ctx, input) => {
    requireRunner(ctx);
    const line = requireLine(ctx, input.line);
    const repo = requireProject(ctx, input.repo).ref;
    const last = latestStart(ctx, "line", line.ref);
    const retry = last !== null && last.state === "failed";
    // A start that failed at once used up nothing, so its retry keeps the name.
    const name = retry ? last.name : `${repo.toLowerCase()}.${nextNumber(ctx, `session:${repo}`)}`;
    const worktree = input.worktree ?? null;
    ctx.sql.run(
      `INSERT INTO agents (name, firstSeenAt, lastSeenAt, checkout, repo, startedBy) VALUES (?, ?, ?, ?, ?, 'octotrack')
       ON CONFLICT(name) DO UPDATE SET goneAt = NULL, checkout = excluded.checkout, firstSeenAt = excluded.firstSeenAt,
         lastSeenAt = excluded.lastSeenAt`,
      [name, ctx.now, ctx.now, worktree, repo],
    );
    ctx.sql.run(
      `INSERT INTO runner_starts (line, repo, name, worktree, state, attempts, startedAt)
       VALUES (?, ?, ?, ?, 'starting', ?, ?)`,
      [line.ref, repo, name, worktree, retry ? last.attempts + 1 : 1, ctx.now],
    );
    emit(ctx, {
      type: "runner.started",
      kind: "agent",
      ref: name,
      project: repo,
      line: line.ref,
      summary: `Started ${name} for ${line.ref}: ${line.title}`,
      attrs: {},
    });
    return { name, line: line.ref, repo };
  }),

  bind(contracts.runnerExited, (ctx, input) => {
    requireRunner(ctx);
    const start = latestStart(ctx, "name", input.name);
    if (start === null) throw new OctoError("not_found", `Octotrack never started ${input.name}`);
    const agent = getAgent(ctx, input.name);
    const output = input.output.trim().slice(-OUTPUT_KEPT) || null;
    const ranCommands = agent !== null && agent.lastSeenAt > start.startedAt;
    const took =
      claimOf(ctx, input.name) !== null ||
      (one(
        ctx,
        z.object({ n: z.number() }),
        "SELECT COUNT(*) AS n FROM events WHERE type = 'line.taken' AND ref = ? AND ts >= ?",
        [input.name, start.startedAt],
      )?.n ?? 0) > 0;
    const state: LineStart["state"] = took
      ? "exited"
      : !ranCommands && input.code !== 0
        ? "failed"
        : "never_took";
    const nextTryAt =
      state === "failed" ? new Date(Date.parse(ctx.now) + retryWait(start.attempts)).toISOString() : null;
    ctx.sql.run("UPDATE runner_starts SET state = ?, output = ?, endedAt = ?, nextTryAt = ? WHERE id = ?", [
      state,
      output,
      ctx.now,
      nextTryAt,
      start.id,
    ]);
    // The process is gone: what it held is offered on, first to it if it can be woken, else to whoever comes next.
    const claim = endClaim(ctx, input.name, "exit");
    if (agent !== null && (agent.wakeAddress === null || state !== "exited")) {
      ctx.sql.run("UPDATE agents SET goneAt = ? WHERE name = ?", [ctx.now, input.name]);
    }
    emit(ctx, {
      type: state === "failed" ? "runner.failed" : "runner.exited",
      kind: "agent",
      ref: input.name,
      project: start.repo,
      line: claim?.line ?? start.line,
      summary:
        state === "failed"
          ? `${input.name} exited at once (code ${input.code}); trying again later${output === null ? "" : `: ${output.split("\n").at(-1) ?? ""}`}`
          : state === "never_took"
            ? `${input.name} ran but never took ${start.line}`
            : `${input.name} exited (code ${input.code})`,
      attrs: { status: state },
    });
    const updated = lineStart(ctx, start.line);
    if (updated === null) throw new OctoError("internal", `The start of ${input.name} vanished`);
    return updated;
  }),

  bind(contracts.runnerRetry, (ctx, input) => {
    requireDeveloper(ctx, "start a session again");
    const line = requireLine(ctx, input.line);
    ctx.sql.run(
      "UPDATE runner_starts SET state = 'failed', nextTryAt = ? WHERE line = ? AND state IN ('failed', 'never_took')",
      [ctx.now, line.ref],
    );
    ctx.visibleChange = true;
    return { line: line.ref };
  }),

  bind(contracts.runnerDry, (ctx, input) => {
    requireRunner(ctx);
    const line = requireLine(ctx, input.line);
    emit(ctx, {
      type: "runner.would_start",
      kind: "line",
      ref: line.ref,
      project: input.repo,
      line: line.ref,
      summary: `Would start a session for ${line.ref} in ${input.repo}; the runner is watching only`,
      attrs: {},
    });
    return { line: line.ref };
  }),

  bind(contracts.runnerCloses, (ctx) =>
    rows(
      ctx,
      z.object({ pr: z.string(), repo: z.string(), number: z.number().int(), line: z.string() }),
      `SELECT DISTINCT p.ref AS pr, p.repo AS repo, p.number AS number, i.line AS line
       FROM prs p JOIN links k ON k.fromRef = p.ref AND k.rel = 'implements'
       JOIN issues i ON i.ref = k.toRef JOIN lines l ON l.ref = i.line
       WHERE p.state IN ('open', 'draft') AND l.state IN ('done', 'dropped') AND l.windDownUntil IS NULL
         AND p.ref NOT IN (SELECT pr FROM runner_closes)
       ORDER BY p.ref`,
    ),
  ),

  bind(contracts.runnerClosed, (ctx, input) => {
    requireRunner(ctx);
    const close = rows(
      ctx,
      z.object({ line: z.string() }),
      "SELECT i.line AS line FROM links k JOIN issues i ON i.ref = k.toRef WHERE k.fromRef = ? AND k.rel = 'implements' AND i.line IS NOT NULL LIMIT 1",
      [input.pr],
    )[0];
    ctx.sql.run("INSERT OR IGNORE INTO runner_closes (pr, line, at) VALUES (?, ?, ?)", [
      input.pr,
      close?.line ?? "",
      ctx.now,
    ]);
    emit(ctx, {
      type: "runner.pr_closed",
      kind: "pr",
      ref: input.pr,
      project: null,
      line: close?.line ?? null,
      summary: `${input.pr} closed on GitHub with ${close?.line ?? "its line"}`,
      attrs: {},
    });
    return { pr: input.pr };
  }),

  bind(contracts.runnerWorktree, (ctx, input) => {
    requireRunner(ctx);
    ctx.sql.run(
      `INSERT INTO runner_worktrees (path, repo, checkout, branch, agent, createdAt) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET agent = excluded.agent, removedAt = NULL`,
      [input.path, input.repo, input.checkout, input.branch, input.agent, ctx.now],
    );
    ctx.visibleChange = true;
    return input;
  }),

  bind(contracts.runnerCleanups, (ctx) =>
    rows(ctx, WorktreeRow, "SELECT * FROM runner_worktrees WHERE removedAt IS NULL ORDER BY createdAt")
      .filter((tree) => {
        const agent = getAgent(ctx, tree.agent);
        const finished = agent === null || agent.goneAt !== null || agent.stoppedAt !== null;
        return finished && claimOf(ctx, tree.agent) === null;
      })
      .map(({ removedAt: _removed, ...tree }) => tree),
  ),

  bind(contracts.runnerRemoved, (ctx, input) => {
    requireRunner(ctx);
    ctx.sql.run("UPDATE runner_worktrees SET removedAt = ? WHERE path = ?", [ctx.now, input.path]);
    ctx.visibleChange = true;
    return { path: input.path };
  }),
];
