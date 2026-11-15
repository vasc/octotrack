import { z } from "zod";
import {
  CHECK_IN_MS,
  endClaim,
  NOT_BLOCKED,
  searchOf,
  searchStep,
  waitingOnYou,
  windingDown,
} from "../agents/claims.ts";
import { agentState, RUNNING_WINDOW_MS } from "../agents/state.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { Line, LineStart, RunnerDue, RunnerStatus, StartRole } from "../schemas.ts";
import { addNotice, claimOf, claimsOn, getAgent } from "../store/agents.ts";
import { emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, placeholders, rows } from "../store/context.ts";
import { allLines, requireLine, requireProject } from "../store/entities.ts";
import { AgentRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireDeveloper } from "./developer.ts";

const MINUTE_MS = 60_000;
/** A start that fails at once is tried again after these waits, then every six hours. */
const RETRY_WAITS_MS = [2, 10, 60, 360].map((minutes) => minutes * MINUTE_MS);
/**
 * A session that takes its line and exits sooner than this, leaving no way to wake it, left at once: the next start
 * for that line waits as a failed one does, or a start command that exits after taking the line would be run again
 * every minute (third audit, N1).
 */
const LEFT_AT_ONCE_MS = 15 * MINUTE_MS;
const OUTPUT_KEPT = 2000;

const StartRow = z.object({
  id: z.number().int(),
  line: z.string(),
  repo: z.string(),
  name: z.string(),
  role: z.enum(["owner", "helper"]),
  worktree: z.string().nullable(),
  state: z.enum(["starting", "running", "failed", "never_took", "exited"]),
  output: z.string().nullable(),
  attempts: z.number().int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  /** When its process ended; null while it still runs, whatever its state says about the line. */
  exitedAt: z.string().nullable(),
  nextTryAt: z.string().nullable(),
  /** When its process was spawned: its check-in runs from then. Null while its worktree and setup are made. */
  spawnedAt: z.string().nullable(),
  pid: z.number().int().nullable(),
  exitCode: z.number().int().nullable(),
  /** It ran and took its line: its name is used up, so a retry after it gets a new one. */
  ran: z.number().int(),
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
const CountRow = z.object({ n: z.number() });
const PathRow = z.object({ path: z.string() });

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

function latestByName(ctx: Ctx, name: string): StartRow | null {
  return one(ctx, StartRow, "SELECT * FROM runner_starts WHERE name = ? ORDER BY id DESC LIMIT 1", [name]);
}

/** The latest session started for a line in a role: owners and helpers are retried and held separately. */
function latestOn(ctx: Ctx, line: string, role: StartRole): StartRow | null {
  return one(
    ctx,
    StartRow,
    "SELECT * FROM runner_starts WHERE line = ? AND role = ? ORDER BY id DESC LIMIT 1",
    [line, role],
  );
}

/** Sessions started for a line that have not checked in yet: each takes the line when it does. */
function startingOn(ctx: Ctx, line: string): number {
  return (
    one(ctx, CountRow, "SELECT COUNT(*) AS n FROM runner_starts WHERE line = ? AND state = 'starting'", [
      line,
    ])?.n ?? 0
  );
}

function toLineStart(start: StartRow): LineStart {
  return {
    name: start.name,
    state: start.state,
    output: start.output,
    attempts: start.attempts,
    at: start.endedAt ?? start.startedAt,
    nextTryAt: start.nextTryAt,
    took: start.ran === 1,
  };
}

/** What home shows for a line: its latest start for an owner, which is what Step in is about. */
export function lineStart(ctx: Ctx, line: string): LineStart | null {
  const start = latestOn(ctx, line, "owner");
  return start === null ? null : toLineStart(start);
}

/**
 * Why a session set up for a line should not run after all, asked once its process is spawned, or null if it should:
 * its line moved on, became the developer's or found an owner, or the developer stopped it, meanwhile (N6).
 */
function whyNotSpawn(ctx: Ctx, start: StartRow): string | null {
  const agent = getAgent(ctx, start.name);
  if (agent?.stoppedAt !== null && agent?.stoppedAt !== undefined)
    return `the developer stopped ${start.name}`;
  const line = requireLine(ctx, start.line);
  if (line.state !== "working") return `${line.ref} is ${line.state.replace("_", " ")} now`;
  if (line.ownedBy !== null) return `${line.ref} is the developer's own now`;
  if (windingDown(line, ctx.now)) return `${line.ref} is winding down`;
  const owner = claimsOn(ctx, line.ref).find((claim) => claim.role === "owner");
  if (start.role === "owner" && owner !== undefined && owner.agent !== start.name) {
    return `${owner.agent} took ${line.ref} meanwhile`;
  }
  return null;
}

/**
 * Sessions whose process is alive as far as Octotrack knows, which is what counts against the cap (D14): every start
 * whose process has not been seen to exit, from its worktree and setup to its end, however silent; and sessions
 * Octotrack started that were woken after their process exited and are at work. One that went to sleep with a wake
 * address keeps its line but holds no process. A command in the last 15 minutes is no sign of a process: it may have
 * exited just after.
 */
function liveSessions(ctx: Ctx): Set<string> {
  const live = rows(ctx, StartRow, "SELECT * FROM runner_starts WHERE exitedAt IS NULL").map(
    (start) => start.name,
  );
  const woken = rows(
    ctx,
    AgentRow,
    `SELECT a.* FROM agents a
     WHERE a.startedBy = 'octotrack' AND a.goneAt IS NULL AND a.stoppedAt IS NULL AND a.wokenAt IS NOT NULL
       AND a.wakeError IS NULL
       AND a.wokenAt > COALESCE((SELECT MAX(s.exitedAt) FROM runner_starts s WHERE s.name = a.name), '')`,
  )
    .filter((agent) => {
      // Woken lately, or at work since: a wake's process ends unseen, so silence after it is taken as its end.
      const latest = Math.max(
        Date.parse(agent.lastSeenAt),
        agent.wokenAt === null ? 0 : Date.parse(agent.wokenAt),
      );
      return Date.parse(ctx.now) - latest <= RUNNING_WINDOW_MS;
    })
    .map((agent) => agent.name);
  return new Set([...live, ...woken]);
}

function activeSessions(ctx: Ctx): number {
  return liveSessions(ctx).size;
}

/** How the developer sent a session away from its line, by the notice it was given, said as its exit's reason. */
const SENT_AWAY: Readonly<Record<string, (line: string) => string>> = {
  stop: () => "stopped by the developer",
  released: () => "released by the developer",
  wind_down: (line) => `after ${line} moved on`,
};

/**
 * Whether the developer sent a session away since it started: stopped it, released it from its line, or moved its line
 * on (tabled, done, dropped or theirs, which winds it down). Its exit soon after is then not leaving at once, and is
 * never held against the next start (fourth audit, A2). An agent's own release is not: a session that takes its line
 * and releases it at once would otherwise be replaced every minute, as one that takes it and exits was (N1).
 */
function sentAwayFrom(ctx: Ctx, start: StartRow): string | null {
  const notice = one(
    ctx,
    z.object({ kind: z.string(), line: z.string().nullable() }),
    `SELECT kind, line FROM notices WHERE agent = ? AND kind IN ('stop', 'released', 'wind_down') AND createdAt >= ?
     ORDER BY id DESC LIMIT 1`,
    [start.name, start.startedAt],
  );
  if (notice === null) return null;
  return SENT_AWAY[notice.kind]?.(notice.line ?? start.line) ?? null;
}

/** What stopped a start, so that Try now can retry every line stopped the same way: its last line of output. */
function stoppedBy(start: { state: string; output: string | null }): string {
  if (start.state === "never_took") return "never took";
  return start.output?.trim().split("\n").at(-1)?.trim() ?? "";
}

/**
 * A running helper Octotrack started, on the lowest line that has one: the first to give way when a line needs an
 * owner and every session the cap allows is in use. Owners come before helpers. An asleep helper holds no session, so
 * asking it to release would free nothing.
 */
function lowestRunningHelper(ctx: Ctx): { agent: string; line: string; since: string } | null {
  const live = liveSessions(ctx);
  const order = new Map(allLines(ctx, "WHERE state = 'working'").map((line, index) => [line.ref, index]));
  const helpers = rows(
    ctx,
    z.object({ agent: z.string(), line: z.string(), since: z.string() }),
    `SELECT c.agent AS agent, c.line AS line, c.since AS since FROM line_claims c JOIN agents a ON a.name = c.agent
     WHERE c.role = 'helper' AND a.startedBy = 'octotrack' AND a.goneAt IS NULL AND a.stoppedAt IS NULL`,
  )
    // Only one whose process is alive holds a session to give back.
    .filter((helper) => live.has(helper.agent))
    .sort((a, b) => (order.get(b.line) ?? -1) - (order.get(a.line) ?? -1));
  return helpers[0] ?? null;
}

/**
 * What the runner can do for a working line that needs an owner. One rule for runner.due, making room and Step in, so
 * a helper is never asked to give way for a line the runner would not start, and Step in shows exactly when it will
 * not:
 * - not needed: not an agents' working line, it has an owner, the search is still offering it, or all its work
 *   waits on the developer;
 * - on its way: a session started for it has not checked in yet;
 * - never took: the last session ran but did not take it, and the developer has not said Try now;
 * - retrying: the last start failed at once and waits to be tried again;
 * - no repo: there is nowhere to start one;
 * - ready: a session can start now, in this repo.
 */
type OwnerStart =
  | { kind: "not_needed" }
  | { kind: "on_its_way" }
  | { kind: "never_took" }
  | { kind: "retrying"; last: StartRow }
  | { kind: "no_repo" }
  | { kind: "ready"; repo: string; last: StartRow | null };

function ownerStart(ctx: Ctx, line: Line): OwnerStart {
  if (line.state !== "working" || line.ownedBy !== null) return { kind: "not_needed" };
  const search = searchOf(ctx, line.ref);
  if (search === null || searchStep(search, ctx.now) !== 3) return { kind: "not_needed" };
  if (claimsOn(ctx, line.ref).some((claim) => claim.role === "owner")) return { kind: "not_needed" };
  // While all its work waits on the developer, a session would have nothing to do.
  if (waitingOnYou(ctx, line.ref)) return { kind: "not_needed" };
  // Any session still starting for it, helper or not, becomes its owner when it checks in.
  if (startingOn(ctx, line.ref) > 0) return { kind: "on_its_way" };
  const last = latestOn(ctx, line.ref, "owner");
  if (last?.state === "never_took" && (last.nextTryAt === null || last.nextTryAt > ctx.now))
    return { kind: "never_took" };
  if (last?.state === "failed" && last.nextTryAt !== null && last.nextTryAt > ctx.now)
    return { kind: "retrying", last };
  const repo = repoFor(ctx, line.ref, line.repos);
  return repo === null ? { kind: "no_repo" } : { kind: "ready", repo, last };
}

/** Helpers wanted on a working line: how many sessions it has work for, and the repo of each one's work. */
function helpersWanted(
  ctx: Ctx,
  line: Line,
): { repos: string[]; count: number; last: StartRow | null } | null {
  if (line.state !== "working" || line.ownedBy !== null || windingDown(line, ctx.now)) return null;
  const crew = claimsOn(ctx, line.ref).filter((claim) => claim.role !== "scoper");
  if (!crew.some((claim) => claim.role === "owner") || line.repos.length === 0) return null;
  const last = latestOn(ctx, line.ref, "helper");
  // As for owners: one that ran but never took the line waits for the developer's Try now.
  if (last?.state === "never_took" && (last.nextTryAt === null || last.nextTryAt > ctx.now)) return null;
  if (last?.state === "failed" && last.nextTryAt !== null && last.nextTryAt > ctx.now) return null;
  const work = rows(
    ctx,
    z.object({ project: z.string() }),
    `SELECT i.project AS project FROM issues i WHERE i.line = ? AND i.status IN ('todo', 'backlog')
       AND i.assignee IS NULL AND i.project IN (${placeholders(line.repos)}) AND ${NOT_BLOCKED}
     ORDER BY i.step IS NULL, i.step, i.createdAt`,
    [line.ref, ...line.repos],
  );
  if (work.length === 0) return null;
  // Who will pick that work up anyway: agents on the line at work and holding nothing, and sessions on their way.
  const idle = crew.filter((claim) => {
    const agent = getAgent(ctx, claim.agent);
    if (agent === null || agentState(agent, ctx.now) !== "running") return false;
    const holding = one(
      ctx,
      CountRow,
      "SELECT COUNT(*) AS n FROM issues WHERE line = ? AND assignee = ? AND status NOT IN ('done', 'cancelled')",
      [line.ref, claim.agent],
    );
    return (holding?.n ?? 0) === 0;
  }).length;
  const coming = idle + startingOn(ctx, line.ref);
  const count = work.length - coming;
  // The work nobody coming will pick up, in order, each helper in the repo of its own.
  return count > 0 ? { repos: work.slice(coming).map((item) => item.project), count, last } : null;
}

/**
 * Whether the developer's Start one anyway still stands for a line: it was asked for the search under way, and is spent
 * once that search ends, by an agent taking the line or the line leaving working on, as it is by a start or by watch
 * mode noting it. Kept from an earlier search, it would pass the cap days later, unasked (fourth audit, A3).
 */
function startsAnyway(ctx: Ctx, line: Line): boolean {
  if (line.startAnyway === null) return false;
  const search = searchOf(ctx, line.ref);
  return search !== null && line.startAnyway >= search.since;
}

/** A line whose owner is still being looked for among agents already here: a session started now could take its turn. */
function seekingOwner(ctx: Ctx, line: Line): boolean {
  if (line.ownedBy !== null || claimsOn(ctx, line.ref).some((claim) => claim.role === "owner")) return false;
  const search = searchOf(ctx, line.ref);
  return search !== null && searchStep(search, ctx.now) < 3;
}

/** A failed start that never ran keeps its name for its retry: nothing of it was used. */
function retryOf(last: StartRow | null): StartRow | null {
  return last !== null && last.state === "failed" && last.ran === 0 ? last : null;
}

/** Which attempt the next start is: failures in a row, whether at once or by leaving at once, count up. */
function attemptAfter(last: StartRow | null): number {
  return last !== null && last.state === "failed" ? last.attempts + 1 : 1;
}

/**
 * At the cap, a line that needs an owner takes the place of the lowest running helper Octotrack started: that helper is
 * asked, once, to release after its current issue, which frees a session for the line. Settled with the other deadlines.
 */
export function makeRoom(ctx: Ctx): void {
  const status = runnerStatus(ctx);
  if (!status.configured || status.dryRun || status.cap - activeSessions(ctx) > 0) return;
  // Start one anyway goes past the cap, so it needs no room.
  const line = allLines(ctx, "WHERE state = 'working'").find(
    (candidate) => !startsAnyway(ctx, candidate) && ownerStart(ctx, candidate).kind === "ready",
  );
  const helper = lowestRunningHelper(ctx);
  if (line === undefined || helper === null) return;
  const asked = one(
    ctx,
    CountRow,
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

/**
 * Whether a working line needs the developer to step in: no owner was found, nothing is starting for it, its work does
 * not all wait on the developer, and the runner cannot help (not set up, watching only, a start that keeps failing or
 * never took the line, nowhere to start one, or every session busy with no helper to give way). One rule, so home, the
 * runner and notifications agree.
 */
export function stepInFor(ctx: Ctx, line: Line): boolean {
  const start = ownerStart(ctx, line);
  if (start.kind === "not_needed" || start.kind === "on_its_way") return false;
  const status = runnerStatus(ctx);
  if (!status.configured || status.dryRun) return true;
  if (start.kind === "never_took" || start.kind === "no_repo") return true;
  // A first failure is retried by itself in minutes; a start that keeps failing needs the developer.
  if (start.last?.state === "failed") return start.last.attempts >= 2;
  // Started anyway, past the cap: a session is on its way.
  if (startsAnyway(ctx, line)) return false;
  // At the cap with a running helper Octotrack started, that helper gives way instead: only owners everywhere needs
  // the developer.
  return status.cap - activeSessions(ctx) <= 0 && lowestRunningHelper(ctx) === null;
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

/** No agent that is not gone works in it: a worktree is never handed to a second session while someone is there. */
const NOBODY_IN =
  "NOT EXISTS (SELECT 1 FROM agents b WHERE b.checkout = w.path AND b.goneAt IS NULL AND b.name <> ?)";

/**
 * The worktree a session should start in, if not a new one. A retry keeps the one its first attempt had, made or
 * handed; any other start takes a worktree a gone session left on this line, once that session's process has ended.
 */
function worktreeFor(ctx: Ctx, name: string, retry: boolean, repo: string, line: string): string | null {
  const row = retry
    ? one(
        ctx,
        PathRow,
        `SELECT w.path AS path FROM runner_worktrees w WHERE w.agent = ? AND w.removedAt IS NULL AND ${NOBODY_IN}
         ORDER BY w.createdAt DESC LIMIT 1`,
        [name, name],
      )
    : one(
        ctx,
        PathRow,
        `SELECT w.path AS path FROM runner_worktrees w JOIN agents a ON a.name = w.agent
         WHERE w.removedAt IS NULL AND w.repo = ? AND a.goneAt IS NOT NULL
           AND EXISTS (SELECT 1 FROM runner_starts s WHERE s.name = w.agent AND s.line = ?)
           AND NOT EXISTS (SELECT 1 FROM runner_starts s WHERE s.name = w.agent AND s.exitedAt IS NULL)
           AND ${NOBODY_IN}
         ORDER BY w.createdAt DESC LIMIT 1`,
        [repo, line, name],
      );
  return row?.path ?? null;
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
    const working = allLines(ctx, "WHERE state = 'working'");
    const owners = working.flatMap((line): RunnerDue[] => {
      const start = ownerStart(ctx, line);
      if (start.kind !== "ready") return [];
      // Start one anyway: past the cap, once, without taking a slot from another line.
      if (!startsAnyway(ctx, line)) {
        if (slots <= 0) return [];
        slots -= 1;
      }
      const retry = retryOf(start.last);
      return [
        {
          line: line.ref,
          repo: start.repo,
          role: "owner",
          name: retry?.name ?? null,
          attempt: attemptAfter(start.last),
        },
      ];
    });
    // Once every working line has an owner, spare sessions under the cap go to helpers for unclaimed work, in line
    // order (D14). A line still offered to the agents here may yet need a session of its own, so helpers wait for it.
    if (slots <= 0 || working.some((line) => seekingOwner(ctx, line))) return owners;
    const helpers: RunnerDue[] = [];
    for (const line of working) {
      const wanted = helpersWanted(ctx, line);
      if (wanted === null) continue;
      const retry = retryOf(wanted.last);
      for (let index = 0; index < wanted.count && slots > 0; index += 1) {
        slots -= 1;
        const again = index === 0 ? retry : null;
        helpers.push({
          line: line.ref,
          // Each helper starts in the repo of the work it is there for: a helper works only in its own repo.
          repo: wanted.repos[index] ?? wanted.repos[0] ?? line.repos[0] ?? "",
          role: "helper",
          name: again?.name ?? null,
          attempt: index === 0 ? attemptAfter(wanted.last) : 1,
        });
      }
    }
    return [...owners, ...helpers];
  }),

  bind(contracts.runnerStart, (ctx, input) => {
    requireRunner(ctx);
    const line = requireLine(ctx, input.line);
    const repo = requireProject(ctx, input.repo).ref;
    const role = input.role ?? "owner";
    const last = latestOn(ctx, line.ref, role);
    const retry = retryOf(last);
    // A start that failed at once used up nothing, so its retry keeps the name.
    const name = retry?.name ?? freshName(ctx, repo);
    if (role === "owner") ctx.sql.run("UPDATE lines SET startAnyway = NULL WHERE ref = ?", [line.ref]);
    // A retry keeps its worktree; otherwise one a gone session left on this line goes to the next session, with
    // whatever it had not pushed.
    const handed = worktreeFor(ctx, name, retry !== null, repo, line.ref);
    const worktree = handed ?? input.worktree ?? null;
    if (handed !== null) {
      ctx.sql.run("UPDATE runner_worktrees SET agent = ? WHERE path = ?", [name, handed]);
    }
    ctx.sql.run(
      `INSERT INTO agents (name, firstSeenAt, lastSeenAt, checkout, repo, startedBy) VALUES (?, ?, ?, ?, ?, 'octotrack')
       ON CONFLICT(name) DO UPDATE SET goneAt = NULL, checkout = excluded.checkout, firstSeenAt = excluded.firstSeenAt,
         lastSeenAt = excluded.lastSeenAt`,
      [name, ctx.now, ctx.now, worktree, repo],
    );
    ctx.sql.run(
      `INSERT INTO runner_starts (line, repo, name, role, worktree, state, attempts, startedAt)
       VALUES (?, ?, ?, ?, ?, 'starting', ?, ?)`,
      [line.ref, repo, name, role, worktree, attemptAfter(last), ctx.now],
    );
    const leftBy = handed !== null && retry === null ? `, in ${handed} that a gone session left` : "";
    emit(ctx, {
      type: "runner.started",
      kind: "agent",
      ref: name,
      project: repo,
      line: line.ref,
      summary: `Started ${name}${role === "helper" ? " as a helper" : ""} for ${line.ref}${leftBy}: ${line.title}`,
      attrs: {},
    });
    const ownBranch =
      (one(ctx, CountRow, "SELECT COUNT(*) AS n FROM runner_worktrees WHERE branch = ?", [`octo/${name}`])
        ?.n ?? 0) > 0;
    return { name, line: line.ref, repo, worktree: handed, ownBranch };
  }),

  bind(contracts.runnerSpawned, (ctx, input) => {
    requireRunner(ctx);
    const start = latestByName(ctx, input.name);
    if (start === null || start.exitedAt !== null) {
      throw new OctoError("not_found", `Octotrack is not starting ${input.name}`);
    }
    // Its worktree and setup may have taken many minutes: whether it should run is asked again now.
    const why = whyNotSpawn(ctx, start);
    if (why === null) {
      ctx.sql.run("UPDATE runner_starts SET spawnedAt = ?, pid = ? WHERE id = ?", [
        ctx.now,
        input.pid,
        start.id,
      ]);
      ctx.visibleChange = true;
      return { go: true, why: null };
    }
    // Ended here, as a start that did not happen: it used up nothing, is not retried, and its process is ended.
    ctx.sql.run(
      "UPDATE runner_starts SET spawnedAt = ?, pid = ?, state = 'exited', endedAt = ?, output = ?, nextTryAt = NULL WHERE id = ?",
      [ctx.now, input.pid, ctx.now, why, start.id],
    );
    ctx.sql.run("UPDATE agents SET goneAt = ? WHERE name = ? AND goneAt IS NULL AND stoppedAt IS NULL", [
      ctx.now,
      input.name,
    ]);
    emit(ctx, {
      type: "runner.not_started",
      kind: "agent",
      ref: input.name,
      project: start.repo,
      line: start.line,
      summary: `Did not start ${input.name} for ${start.line}: ${why}`,
      attrs: {},
    });
    return { go: false, why };
  }),

  bind(contracts.runnerLive, (ctx) =>
    rows(
      ctx,
      z.object({ name: z.string(), pid: z.number().int().nullable(), spawnedAt: z.string().nullable() }),
      "SELECT name, pid, spawnedAt FROM runner_starts WHERE exitedAt IS NULL ORDER BY id",
    ),
  ),

  bind(contracts.runnerExited, (ctx, input) => {
    requireRunner(ctx);
    const start = latestByName(ctx, input.name);
    if (start === null) throw new OctoError("not_found", `Octotrack never started ${input.name}`);
    // Told not to go once spawned, or already seen to exit: only its end is recorded.
    if (start.exitedAt !== null || (start.state === "exited" && start.endedAt !== null)) {
      ctx.sql.run(
        "UPDATE runner_starts SET exitedAt = COALESCE(exitedAt, ?), exitCode = COALESCE(exitCode, ?) WHERE id = ?",
        [ctx.now, input.code, start.id],
      );
      return toLineStart({ ...start, exitedAt: start.exitedAt ?? ctx.now });
    }
    const agent = getAgent(ctx, input.name);
    const output = input.output.trim().slice(-OUTPUT_KEPT) || null;
    const ranCommands = agent !== null && agent.lastSeenAt > start.startedAt;
    const took =
      claimOf(ctx, input.name) !== null ||
      (one(
        ctx,
        CountRow,
        "SELECT COUNT(*) AS n FROM events WHERE type = 'line.taken' AND ref = ? AND ts >= ?",
        [input.name, start.startedAt],
      )?.n ?? 0) > 0;
    // Only an exit at once spent nothing and is retried by itself (D14). One that outlived its check-in ran, whatever
    // its exit code, and waits for the developer like any other that never took its line. The check-in runs from the
    // spawn: an exit before it, while the worktree or setup was made, is at once.
    const spawnedAt = start.spawnedAt;
    const sinceSpawn = spawnedAt === null ? 0 : Date.parse(ctx.now) - Date.parse(spawnedAt);
    const atOnce = start.state === "starting" && sinceSpawn < CHECK_IN_MS;
    // A session that took its line and can be woken is only asleep: it keeps its line (D14's agent states). Any
    // other is gone, and what it held is offered on.
    const keeps = took && agent !== null && agent.wakeAddress !== null;
    // The developer stopped it, released it, or moved its line on: it was sent away rather than leaving by itself.
    const sentAway = took ? sentAwayFrom(ctx, start) : null;
    // One that took its line and left at once by itself, with no way to wake it, waits like a failed start before the
    // next.
    const leftAtOnce = took && !keeps && sentAway === null && sinceSpawn < LEFT_AT_ONCE_MS;
    const state: LineStart["state"] = leftAtOnce
      ? "failed"
      : took
        ? "exited"
        : atOnce && !ranCommands && input.code !== 0
          ? "failed"
          : "never_took";
    const nextTryAt =
      state === "failed"
        ? new Date(Date.parse(ctx.now) + retryWait(start.attempts)).toISOString()
        : state === "never_took"
          ? start.nextTryAt
          : null;
    const told = leftAtOnce
      ? `${input.name} took ${start.line} and exited soon after, with no wake address. Sessions that keep doing this are started less often, then need you: keep the session running, or have it register a wake address (octo agent register --wake).`
      : null;
    const kept = told === null ? output : `${output === null ? "" : `${output}\n`}${told}`;
    ctx.sql.run(
      "UPDATE runner_starts SET state = ?, output = ?, endedAt = ?, exitedAt = ?, nextTryAt = ?, exitCode = ?, ran = ? WHERE id = ?",
      [state, kept, ctx.now, ctx.now, nextTryAt, input.code, took ? 1 : 0, start.id],
    );
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
      summary: leftAtOnce
        ? `${input.name} took ${start.line} and exited soon after (code ${input.code}), with no wake address; the next start waits`
        : state === "failed"
          ? `${input.name} exited at once (code ${input.code}); trying again later${output === null ? "" : `: ${output.split("\n").at(-1) ?? ""}`}`
          : state === "never_took"
            ? `${input.name} ran but never took ${start.line}${input.code === 0 ? "" : ` (code ${input.code})`}`
            : `${input.name} exited (code ${input.code})${sentAway === null ? "" : `, ${sentAway}`}`,
      attrs: { status: state },
    });
    return {
      name: start.name,
      state,
      output: kept,
      attempts: start.attempts,
      at: ctx.now,
      nextTryAt,
      took,
    };
  }),

  bind(contracts.runnerRetry, (ctx, input) => {
    requireDeveloper(ctx, "start a session again");
    const line = requireLine(ctx, input.line);
    const last = latestOn(ctx, line.ref, "owner");
    // Try now on one stopped line retries every line stopped the same way: one fix, such as logging in, fixes all.
    const lines =
      input.same === true && last !== null && (last.state === "failed" || last.state === "never_took")
        ? allLines(ctx, "WHERE state = 'working'")
            .filter((other) => {
              const theirs = latestOn(ctx, other.ref, "owner");
              return theirs !== null && theirs.state === last.state && stoppedBy(theirs) === stoppedBy(last);
            })
            .map((other) => other.ref)
        : [line.ref];
    // Due now. One that never took keeps saying so, so its retry gets a new name: that session ran, and may still.
    for (const ref of lines) {
      ctx.sql.run(
        "UPDATE runner_starts SET nextTryAt = ? WHERE line = ? AND state IN ('failed', 'never_took')",
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
    const role = input.role ?? "owner";
    // Watch mode notes a Start one anyway as it would start it, and so spends it: it is not kept for later (A3).
    if (role === "owner") ctx.sql.run("UPDATE lines SET startAnyway = NULL WHERE ref = ?", [line.ref]);
    // Once per search for an owner, or for helpers once per owner, not once a tick (third audit, N22).
    const since =
      role === "owner"
        ? (searchOf(ctx, line.ref)?.since ?? "")
        : (claimsOn(ctx, line.ref).find((claim) => claim.role === "owner")?.since ?? "");
    const noted =
      (one(
        ctx,
        CountRow,
        `SELECT COUNT(*) AS n FROM events WHERE type = 'runner.would_start' AND line = ? AND ts >= ?
           AND COALESCE(json_extract(attrs, '$.role'), 'owner') = ?`,
        [line.ref, since, role],
      )?.n ?? 0) > 0;
    if (noted) return { line: line.ref };
    emit(ctx, {
      type: "runner.would_start",
      kind: "line",
      ref: line.ref,
      project: input.repo,
      line: line.ref,
      summary: `Would start ${role === "helper" ? "a helper" : "a session"} for ${line.ref} in ${input.repo}; the runner is watching only`,
      attrs: { role },
    });
    return { line: line.ref };
  }),

  bind(contracts.runnerCloses, (ctx) =>
    rows(
      ctx,
      z.object({ pr: z.string(), repo: z.string(), number: z.number().int(), line: z.string() }),
      // Only those open when the line ended, unchanged since and as GitHub still reports them (D14); only in the
      // GitHub repo of the issue it implements, since a pull request's row may name any repo; and never while it also
      // implements work still wanted: an open issue, or one on a line that has not ended.
      `SELECT p.ref AS pr, p.repo AS repo, p.number AS number, MIN(i.line) AS line
       FROM prs p JOIN links k ON k.fromRef = p.ref AND k.rel = 'implements'
       JOIN issues i ON i.ref = k.toRef JOIN lines l ON l.ref = i.line
       JOIN projects r ON r.ref = i.project
       JOIN line_closing_prs s ON s.line = l.ref AND s.pr = p.ref AND s.headSha = p.headSha
       WHERE p.state IN ('open', 'draft') AND l.state IN ('done', 'dropped') AND l.windDownUntil IS NULL
         AND p.githubAt IS NOT NULL
         AND i.status IN ('done', 'cancelled')
         AND r.repo IS NOT NULL AND lower(r.repo) = lower(p.repo)
         AND NOT EXISTS (
           SELECT 1 FROM links k2 JOIN issues i2 ON i2.ref = k2.toRef LEFT JOIN lines l2 ON l2.ref = i2.line
           WHERE k2.fromRef = p.ref AND k2.rel = 'implements'
             AND (i2.status NOT IN ('done', 'cancelled')
               OR (l2.ref IS NOT NULL AND (l2.state NOT IN ('done', 'dropped') OR l2.windDownUntil IS NOT NULL))))
         AND p.ref NOT IN (SELECT pr FROM runner_closes WHERE dry = 0)
       GROUP BY p.ref, p.repo, p.number
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
    // that one's process has not exited.
    const inUse = new Set(
      rows(
        ctx,
        AgentRow,
        "SELECT * FROM agents WHERE goneAt IS NULL AND stoppedAt IS NULL AND checkout IS NOT NULL",
      ).flatMap((agent) => (agent.checkout === null ? [] : [agent.checkout])),
    );
    const live = new Set(
      rows(ctx, StartRow, "SELECT * FROM runner_starts WHERE exitedAt IS NULL").map((start) => start.name),
    );
    return rows(ctx, WorktreeRow, "SELECT * FROM runner_worktrees WHERE removedAt IS NULL ORDER BY createdAt")
      .filter((tree) => !inUse.has(tree.path) && !live.has(tree.agent) && claimOf(ctx, tree.agent) === null)
      .map(({ removedAt: _removed, ...tree }) => tree);
  }),

  bind(contracts.runnerRestarted, (ctx, input) => {
    requireRunner(ctx);
    // Sessions from before the server restarted whose process is gone are settled as exited. One whose process still
    // runs keeps its line, its worktree and its slot, and the runner watches it by its process id (third audit, N10).
    const alive = new Set(input.alive ?? []);
    const orphans = rows(ctx, StartRow, "SELECT * FROM runner_starts WHERE exitedAt IS NULL").filter(
      (start) => !alive.has(start.name),
    );
    for (const start of orphans) {
      ctx.runOp(
        contracts.runnerExited.name,
        {
          name: start.name,
          code: -1,
          output:
            start.spawnedAt === null
              ? "The server restarted while this session was being set up, so it never ran."
              : "The server restarted while this session ran, and its process has ended since.",
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
    if (input.dry === true) {
      // Watch mode only records (D13): noted once per Stop, and still due for when the runner may act.
      const noted = one(
        ctx,
        CountRow,
        `SELECT COUNT(*) AS n FROM events e JOIN agents a ON a.name = e.ref
         WHERE e.type = 'runner.would_stop' AND e.ref = ? AND e.ts >= a.stoppedAt`,
        [input.name],
      );
      if ((noted?.n ?? 0) === 0) {
        emit(ctx, {
          type: "runner.would_stop",
          kind: "agent",
          ref: input.name,
          project: null,
          summary: `Would run the stop command for ${input.name}; the runner is watching only`,
          attrs: {},
        });
      }
      return { name: input.name };
    }
    ctx.sql.run("UPDATE agents SET stopRanAt = ? WHERE name = ?", [ctx.now, input.name]);
    const ended = input.ended === true ? `Ended ${input.name}'s process` : null;
    // A negative code says the runner did not run the command, and why.
    const command =
      input.command === false
        ? null
        : input.code < 0
          ? `did not run the stop command: ${input.output.trim()}`
          : `ran the stop command for ${input.name}${input.code === 0 ? "" : `, which exited ${input.code}: ${input.output.trim().split("\n").at(-1) ?? ""}`}`;
    const said = [ended, command].flatMap((part) => (part === null ? [] : [part])).join(", and ");
    emit(ctx, {
      type: "runner.stop_ran",
      kind: "agent",
      ref: input.name,
      project: null,
      summary: `${said.charAt(0).toUpperCase()}${said.slice(1)}`,
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
      attrs: ctx.said === null ? {} : { said: ctx.said },
    });
    // Step in's "Set its checkout" fixes what stopped the line, so it tries again in the same choice.
    if (input.retry !== undefined) {
      ctx.runOp(
        contracts.runnerRetry.name,
        { line: input.retry, same: true },
        { actor: ctx.actor, channel: ctx.channel, said: ctx.said },
      );
    }
    return requireProject(ctx, project.ref);
  }),
];
