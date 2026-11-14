import { z } from "zod";
import { endClaim, searchOf, searchStep, waitingOnYou } from "../agents/claims.ts";
import { agentState } from "../agents/state.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { Line, LineStart, RunnerDue, RunnerStatus } from "../schemas.ts";
import { addNotice, claimOf, claimsOn, getAgent } from "../store/agents.ts";
import { emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { allLines, requireLine, requireProject } from "../store/entities.ts";
import { AgentRow } from "../store/rows.ts";
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
/**
 * Sessions that count against the cap: those still starting, and those Octotrack started that are running now. One
 * that went to sleep with a wake address keeps its line, but no longer takes a process.
 */
function activeSessions(ctx: Ctx): number {
  const starting = rows(ctx, StartRow, "SELECT * FROM runner_starts WHERE state = 'starting'").map(
    (start) => start.name,
  );
  const running = rows(
    ctx,
    AgentRow,
    "SELECT * FROM agents WHERE startedBy = 'octotrack' AND goneAt IS NULL AND stoppedAt IS NULL",
  )
    .filter((agent) => agentState(agent, ctx.now) === "running")
    .map((agent) => agent.name);
  return new Set([...starting, ...running]).size;
}

/**
 * Whether a working line needs the developer to step in: no owner was found, nothing is starting for it, its work does
 * not all wait on the developer, and the runner cannot help (not set up, watching only, a start that keeps failing or
 * never took the line, or every session busy). One rule, so home, the runner and notifications agree.
 */
/** What stopped a start, so that Try now can retry every line stopped the same way: its last line of output. */
function stoppedBy(start: { state: string; output: string | null }): string {
  if (start.state === "never_took") return "never took";
  return start.output?.trim().split("\n").at(-1)?.trim() ?? "";
}

/**
 * A helper Octotrack started, on the lowest line that has one: the first to give way when a line needs an owner and
 * every session the cap allows is running. Owners come before helpers.
 */
function lowestHelper(ctx: Ctx): { agent: string; line: string; since: string } | null {
  const order = new Map(allLines(ctx, "WHERE state = 'working'").map((line, index) => [line.ref, index]));
  const helpers = rows(
    ctx,
    z.object({ agent: z.string(), line: z.string(), since: z.string() }),
    `SELECT c.agent AS agent, c.line AS line, c.since AS since FROM line_claims c JOIN agents a ON a.name = c.agent
     WHERE c.role = 'helper' AND a.startedBy = 'octotrack' AND a.goneAt IS NULL AND a.stoppedAt IS NULL`,
  ).sort((a, b) => (order.get(b.line) ?? -1) - (order.get(a.line) ?? -1));
  return helpers[0] ?? null;
}

/** Working lines at step 3 of the search with nothing starting for them: the ones a session would be started for. */
function needingStart(ctx: Ctx): Line[] {
  return allLines(ctx, "WHERE state = 'working' AND ownedBy IS NULL").filter((line) => {
    const search = searchOf(ctx, line.ref);
    if (search === null || searchStep(search, ctx.now) !== 3) return false;
    if (claimsOn(ctx, line.ref).some((claim) => claim.role === "owner")) return false;
    if (waitingOnYou(ctx, line.ref)) return false;
    const start = latestStart(ctx, "line", line.ref);
    return start === null || (start.state !== "starting" && start.state !== "running");
  });
}

/**
 * At the cap, a line that needs an owner takes the place of the lowest helper Octotrack started: that helper is asked,
 * once, to release after its current issue, which frees a session for the line. Settled with the other deadlines.
 */
export function makeRoom(ctx: Ctx): void {
  const status = runnerStatus(ctx);
  if (!status.configured || status.dryRun || status.cap - activeSessions(ctx) > 0) return;
  const line = needingStart(ctx)[0];
  const helper = lowestHelper(ctx);
  if (line === undefined || helper === null) return;
  const asked = one(
    ctx,
    z.object({ n: z.number() }),
    "SELECT COUNT(*) AS n FROM notices WHERE agent = ? AND kind = 'release_asked' AND createdAt >= ?",
    [helper.agent, helper.since],
  );
  if ((asked?.n ?? 0) > 0) return;
  addNotice(
    ctx,
    helper.agent,
    "release_asked",
    helper.line,
    `${line.ref} needs an owner and every session is in use. Finish your current issue on ${helper.line}, then release it: octo line release.`,
    true,
  );
}

export function stepInFor(ctx: Ctx, line: Line): boolean {
  if (line.state !== "working" || line.ownedBy !== null) return false;
  const search = searchOf(ctx, line.ref);
  if (search === null || searchStep(search, ctx.now) !== 3) return false;
  if (claimsOn(ctx, line.ref).some((claim) => claim.role === "owner")) return false;
  if (waitingOnYou(ctx, line.ref)) return false;
  const start = latestStart(ctx, "line", line.ref);
  if (start !== null && (start.state === "starting" || start.state === "running")) return false;
  const status = runnerStatus(ctx);
  if (!status.configured || status.dryRun) return true;
  if (start?.state === "never_took") return true;
  // A first failure is retried by itself in minutes; a start that keeps failing needs the developer.
  if (start?.state === "failed") return start.attempts >= 2;
  // Started anyway, past the cap: a session is on its way.
  if (line.startAnyway !== null) return false;
  // At the cap with a helper Octotrack started, that helper gives way instead: only owners everywhere needs the developer.
  return status.cap - activeSessions(ctx) <= 0 && lowestHelper(ctx) === null;
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

/** The next session name for a repo, upward from its name and never one an agent already uses. */
function freshName(ctx: Ctx, repo: string): string {
  for (;;) {
    const name = `${repo.toLowerCase()}.${nextNumber(ctx, `session:${repo}`)}`;
    if (getAgent(ctx, name) === null) return name;
  }
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
      // While all its work waits on the developer, a session would have nothing to do.
      if (waitingOnYou(ctx, line.ref)) return [];
      const last = latestStart(ctx, "line", line.ref);
      if (last !== null && (last.state === "starting" || last.state === "never_took")) return [];
      if (last?.state === "failed" && last.nextTryAt !== null && last.nextTryAt > ctx.now) return [];
      const repo = repoFor(ctx, line.ref, line.repos);
      if (repo === null) return [];
      // Start one anyway: past the cap, once, without taking a slot from another line.
      if (line.startAnyway === null) {
        if (slots <= 0) return [];
        slots -= 1;
      }
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
    const name = retry ? last.name : freshName(ctx, repo);
    ctx.sql.run("UPDATE lines SET startAnyway = NULL WHERE ref = ?", [line.ref]);
    // A worktree a gone session left on this line goes to the next session, with whatever it had not pushed.
    const handed = retry
      ? null
      : one(
          ctx,
          z.object({ path: z.string() }),
          `SELECT w.path AS path FROM runner_worktrees w JOIN agents a ON a.name = w.agent
           WHERE w.removedAt IS NULL AND w.repo = ? AND a.goneAt IS NOT NULL
             AND EXISTS (SELECT 1 FROM runner_starts s WHERE s.name = w.agent AND s.line = ?)
           ORDER BY w.createdAt DESC LIMIT 1`,
          [repo, line.ref],
        );
    const worktree = handed?.path ?? input.worktree ?? null;
    if (handed !== null) {
      ctx.sql.run("UPDATE runner_worktrees SET agent = ? WHERE path = ?", [name, handed.path]);
    }
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
      summary: `Started ${name} for ${line.ref}${handed === null ? "" : `, in ${handed.path} that a gone session left`}: ${line.title}`,
      attrs: {},
    });
    return { name, line: line.ref, repo, worktree: handed?.path ?? null };
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
    // A session that took its line and can be woken is only asleep: it keeps its line (D14's agent states). Any
    // other is gone, and what it held is offered on.
    const keeps = state === "exited" && agent !== null && agent.wakeAddress !== null;
    const claim = keeps ? claimOf(ctx, input.name) : endClaim(ctx, input.name, "exit");
    if (agent !== null && !keeps) {
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
    const last = latestStart(ctx, "line", line.ref);
    // Try now on one stopped line retries every line stopped the same way: one fix, such as logging in, fixes all.
    const lines =
      input.same === true && last !== null && (last.state === "failed" || last.state === "never_took")
        ? allLines(ctx, "WHERE state = 'working'")
            .filter((other) => {
              const theirs = latestStart(ctx, "line", other.ref);
              return theirs !== null && theirs.state === last.state && stoppedBy(theirs) === stoppedBy(last);
            })
            .map((other) => other.ref)
        : [line.ref];
    for (const ref of lines) {
      ctx.sql.run(
        "UPDATE runner_starts SET state = 'failed', nextTryAt = ? WHERE line = ? AND state IN ('failed', 'never_took')",
        [ctx.now, ref],
      );
    }
    if (input.anyway === true)
      ctx.sql.run("UPDATE lines SET startAnyway = ? WHERE ref = ?", [ctx.now, line.ref]);
    ctx.visibleChange = true;
    return { lines };
  }),

  bind(contracts.runnerDry, (ctx, input) => {
    requireRunner(ctx);
    const line = requireLine(ctx, input.line);
    // Once per search for an owner, not once a tick.
    const since = searchOf(ctx, line.ref)?.since ?? "";
    const noted =
      (one(
        ctx,
        z.object({ n: z.number() }),
        "SELECT COUNT(*) AS n FROM events WHERE type = 'runner.would_start' AND line = ? AND ts >= ?",
        [line.ref, since],
      )?.n ?? 0) > 0;
    if (noted) return { line: line.ref };
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
         AND i.status IN ('done', 'cancelled')
         AND p.ref NOT IN (SELECT pr FROM runner_closes WHERE dry = 0)
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
    const dry = input.dry === true;
    const before = one(ctx, z.object({ dry: z.number() }), "SELECT dry FROM runner_closes WHERE pr = ?", [
      input.pr,
    ]);
    // In watch mode it is noted once; once real, it is closed for good.
    if (dry && before !== null) return { pr: input.pr };
    if (!dry && before !== null && before.dry === 0) return { pr: input.pr };
    ctx.sql.run(
      `INSERT INTO runner_closes (pr, line, at, dry) VALUES (?, ?, ?, ?)
       ON CONFLICT(pr) DO UPDATE SET dry = excluded.dry, at = excluded.at`,
      [input.pr, close?.line ?? "", ctx.now, dry ? 1 : 0],
    );
    emit(ctx, {
      type: dry ? "runner.would_close" : "runner.pr_closed",
      kind: "pr",
      ref: input.pr,
      project: null,
      line: close?.line ?? null,
      summary: dry
        ? `Would close ${input.pr} on GitHub with ${close?.line ?? "its line"}; the runner is watching only`
        : `${input.pr} closed on GitHub with ${close?.line ?? "its line"}`,
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

  bind(contracts.runnerCleanups, (ctx) => {
    // In use while any agent that is neither gone nor stopped works there, the one it was made for holds a line, or
    // that one's session is still starting or running.
    const inUse = new Set(
      rows(
        ctx,
        AgentRow,
        "SELECT * FROM agents WHERE goneAt IS NULL AND stoppedAt IS NULL AND checkout IS NOT NULL",
      ).flatMap((agent) => (agent.checkout === null ? [] : [agent.checkout])),
    );
    const live = new Set(
      rows(ctx, StartRow, "SELECT * FROM runner_starts WHERE state IN ('starting', 'running')").map(
        (start) => start.name,
      ),
    );
    return rows(ctx, WorktreeRow, "SELECT * FROM runner_worktrees WHERE removedAt IS NULL ORDER BY createdAt")
      .filter((tree) => !inUse.has(tree.path) && !live.has(tree.agent) && claimOf(ctx, tree.agent) === null)
      .map(({ removedAt: _removed, ...tree }) => tree);
  }),

  bind(contracts.runnerRestarted, (ctx) => {
    requireRunner(ctx);
    // Sessions from before the server restarted are not the runner's to watch any more: each is settled as exited.
    const orphans = rows(ctx, StartRow, "SELECT * FROM runner_starts WHERE state IN ('starting', 'running')");
    for (const start of orphans) {
      ctx.runOp(
        contracts.runnerExited.name,
        {
          name: start.name,
          code: -1,
          output: "The server restarted while this session ran, so its end was not seen.",
        },
        { actor: ctx.actor, channel: ctx.channel, said: null, system: true },
      );
    }
    ctx.visibleChange = orphans.length > 0 || ctx.visibleChange;
    return { settled: orphans.length };
  }),

  bind(contracts.runnerRemoved, (ctx, input) => {
    requireRunner(ctx);
    ctx.sql.run("UPDATE runner_worktrees SET removedAt = ? WHERE path = ?", [ctx.now, input.path]);
    ctx.visibleChange = true;
    return { path: input.path };
  }),

  bind(contracts.runnerStops, (ctx) =>
    rows(
      ctx,
      z.object({ name: z.string() }),
      "SELECT name FROM agents WHERE stoppedAt IS NOT NULL AND stopRanAt IS NULL ORDER BY stoppedAt",
    ),
  ),

  bind(contracts.runnerStopRan, (ctx, input) => {
    requireRunner(ctx);
    ctx.sql.run("UPDATE agents SET stopRanAt = ? WHERE name = ?", [ctx.now, input.name]);
    emit(ctx, {
      type: "runner.stop_ran",
      kind: "agent",
      ref: input.name,
      project: null,
      summary: `Ran the stop command for ${input.name}${input.code === 0 ? "" : `, which exited ${input.code}: ${input.output.trim().split("\n").at(-1) ?? ""}`}`,
      attrs: {},
    });
    return { name: input.name };
  }),

  bind(contracts.repoCheckout, (ctx, input) => {
    requireDeveloper(ctx, "set a repo's checkout");
    const project = requireProject(ctx, input.repo);
    ctx.sql.run("UPDATE projects SET checkout = ? WHERE ref = ?", [input.path, project.ref]);
    emit(ctx, {
      type: "project.updated",
      kind: "project",
      ref: project.ref,
      project: project.ref,
      summary: `${project.ref}'s checkout is ${input.path}`,
      attrs: {},
    });
    return requireProject(ctx, project.ref);
  }),
];
