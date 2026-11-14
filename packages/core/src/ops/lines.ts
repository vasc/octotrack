import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { EventAttrs, Line, LinePlacement, LineState, PlanStep } from "../schemas.ts";
import { applyPatch, type Changes, emit, nextNumber } from "../store/common.ts";
import { rankAtEnd } from "../store/ranks.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { allLines, requireLine, requireProject, summarize } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { IssueRow, PlanStepRow } from "../store/rows.ts";
import { afterAdd, afterMove, crewOf, guardLineWrite } from "../agents/claims.ts";
import { bind } from "./bind.ts";
import { requireDeveloper } from "./developer.ts";

const DONE_LATELY_MS = 7 * 24 * 60 * 60 * 1000;
/** Below this gap two ranks are too close to split again, so the section is renumbered. */
const SMALLEST_GAP = 1e-6;

const ENDED: ReadonlySet<LineState> = new Set(["done", "dropped"]);

function lineAttrs(ctx: Ctx, line: Line): EventAttrs {
  return {
    status: line.state,
    channel: ctx.channel,
    ...(line.repos.length === 0 ? {} : { repo: line.repos }),
    ...(ctx.said === null ? {} : { said: ctx.said }),
  };
}

function emitLine(
  ctx: Ctx,
  type: string,
  line: Line,
  summary: string,
  changes?: Changes,
  related?: string[],
): void {
  emit(ctx, {
    type,
    kind: "line",
    ref: line.ref,
    project: line.repos[0] ?? null,
    line: line.ref,
    summary,
    attrs: lineAttrs(ctx, line),
    changes,
    related,
  });
}

function checkRepos(ctx: Ctx, repos: readonly string[] | undefined): string[] {
  return [...new Set((repos ?? []).map((repo) => requireProject(ctx, repo).ref))];
}

function setRepos(ctx: Ctx, line: string, repos: readonly string[]): void {
  ctx.sql.run("DELETE FROM line_repos WHERE line = ?", [line]);
  repos.forEach((repo, position) => {
    ctx.sql.run("INSERT INTO line_repos (line, repo, position) VALUES (?, ?, ?)", [line, repo, position]);
  });
}

interface NewLine {
  title: string;
  doneWhen: string;
  repos: string[];
  state: LineState;
  tabledReason: string | null;
  lookAgainAt: string | null;
  proposedBy: string | null;
  recommendation: LinePlacement | null;
  recommendationWhy: string | null;
}

function insertLine(ctx: Ctx, input: NewLine): Line {
  const ref = `L-${nextNumber(ctx, "line")}`;
  ctx.sql.run(
    `INSERT INTO lines (ref, title, doneWhen, state, rank, tabledReason, lookAgainAt, proposedBy, recommendation,
       recommendationWhy, source, version, createdAt, updatedAt, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      ref,
      input.title,
      input.doneWhen,
      input.state,
      rankAtEnd(ctx, input.state),
      input.tabledReason,
      input.lookAgainAt,
      input.proposedBy,
      input.recommendation,
      input.recommendationWhy,
      ctx.developer && input.proposedBy === null ? "developer" : "agent",
      ctx.now,
      ctx.now,
      ctx.actor,
    ],
  );
  setRepos(ctx, ref, input.repos);
  return requireLine(ctx, ref);
}

const PLACE_STATE: Readonly<Record<"start" | "queue", LineState>> = { start: "working", queue: "up_next" };

/** Which states a move may leave from. A line that ended stays ended: new work is a new line. */
const MOVES = {
  start: { to: "working", from: ["proposed", "up_next", "tabled"], event: "line.started", verb: "started" },
  queue: { to: "up_next", from: ["proposed", "working", "tabled"], event: "line.queued", verb: "is up next" },
  table: {
    to: "tabled",
    from: ["proposed", "working", "up_next", "tabled"],
    event: "line.tabled",
    verb: "tabled",
  },
  done: { to: "done", from: ["working", "up_next", "tabled"], event: "line.done", verb: "is done" },
  drop: {
    to: "dropped",
    from: ["proposed", "working", "up_next", "tabled"],
    event: "line.dropped",
    verb: "dropped",
  },
  reject: { to: "dropped", from: ["proposed"], event: "line.rejected", verb: "is not a line" },
} as const satisfies Record<
  string,
  { to: LineState; from: readonly LineState[]; event: string; verb: string }
>;

type MoveName = keyof typeof MOVES;

function move(
  ctx: Ctx,
  rawRef: string,
  name: MoveName,
  extra: { tabledReason?: string; lookAgainAt?: string | null } = {},
): Line {
  const rule = MOVES[name];
  requireDeveloper(ctx, `${name} a line`);
  const current = requireLine(ctx, rawRef);
  if (current.state === rule.to && name !== "table") return current;
  const allowed: readonly LineState[] = rule.from;
  if (!allowed.includes(current.state)) {
    throw new OctoError(
      "conflict",
      `${current.ref} is ${current.state.replace("_", " ")}, so it cannot be ${name === "reject" ? "rejected" : `moved that way`}`,
      ENDED.has(current.state)
        ? "A line that ended stays ended. Add a new line for new work."
        : name === "reject"
          ? "Only a proposal can be rejected. Drop a line that was placed: octo line drop."
          : null,
    );
  }
  // A line out of tabled no longer waits for anything; one back under Proposed by its date keeps the reason beside it.
  const leavingTable = current.tabledReason !== null && rule.to !== "tabled";
  const changes = applyPatch(ctx, "lines", current.ref, current, {
    state: rule.to,
    rank: current.state === rule.to ? undefined : rankAtEnd(ctx, rule.to),
    tabledReason: rule.to === "tabled" ? extra.tabledReason : leavingTable ? null : undefined,
    lookAgainAt: rule.to === "tabled" ? (extra.lookAgainAt ?? null) : leavingTable ? null : undefined,
  });
  const updated = requireLine(ctx, current.ref);
  afterMove(ctx, current, updated);
  if (Object.keys(changes).length > 0) {
    const why = rule.to === "tabled" ? `: ${extra.tabledReason ?? ""}` : "";
    emitLine(ctx, rule.event, updated, `${updated.ref} ${rule.verb}${why} (${updated.title})`, changes);
  }
  return updated;
}

function sectionOf(ctx: Ctx, state: LineState): Line[] {
  return allLines(ctx, "WHERE state = ?", [state]);
}

/** Gives a section ranks 1..n in its current order. Rank is placement only, so this is not a change anyone sees. */
function renumber(ctx: Ctx, section: readonly Line[]): void {
  section.forEach((line, index) => {
    ctx.sql.run("UPDATE lines SET rank = ? WHERE ref = ?", [index + 1, line.ref]);
  });
}

function rankBetween(low: number | null, high: number | null): number {
  if (low === null && high === null) return 1;
  if (low === null) return (high ?? 0) - 1;
  if (high === null) return low + 1;
  return (low + high) / 2;
}

function targetRank(
  ctx: Ctx,
  line: Line,
  input: { to?: "top" | "bottom"; before?: string; after?: string },
): number {
  const given = [input.to, input.before, input.after].filter((value) => value !== undefined);
  if (given.length !== 1) {
    throw new OctoError(
      "invalid_input",
      "Say where the line goes: one of --top, --bottom, --before or --after",
    );
  }
  const others = sectionOf(ctx, line.state).filter((other) => other.ref !== line.ref);
  if (input.to === "top") return rankBetween(null, others[0]?.rank ?? null);
  if (input.to === "bottom") return rankBetween(others.at(-1)?.rank ?? null, null);
  const anchorRef = input.before ?? input.after ?? "";
  const anchor = requireLine(ctx, anchorRef);
  const index = others.findIndex((other) => other.ref === anchor.ref);
  if (index === -1) {
    throw new OctoError(
      "invalid_input",
      `${anchor.ref} is ${anchor.state.replace("_", " ")}, not ${line.state.replace("_", " ")}`,
      "Lines move within their own section.",
    );
  }
  const low = input.before === undefined ? anchor.rank : (others[index - 1]?.rank ?? null);
  const high = input.before === undefined ? (others[index + 1]?.rank ?? null) : anchor.rank;
  if (low !== null && high !== null && high - low < SMALLEST_GAP) {
    renumber(ctx, others);
    return targetRank(ctx, line, input);
  }
  return rankBetween(low, high);
}

function planOf(ctx: Ctx, line: string): PlanStep[] {
  return rows(ctx, PlanStepRow, "SELECT * FROM plan_steps WHERE line = ? ORDER BY position", [line]);
}

/** A step an issue names must exist in its line's plan. */
export function checkStep(ctx: Ctx, line: string | null, step: number | null): void {
  if (step === null) return;
  if (line === null) {
    throw new OctoError("invalid_input", "A step belongs to a line's plan", "Pass --line as well as --step.");
  }
  const steps = planOf(ctx, line);
  if (step > steps.length) {
    throw new OctoError(
      "invalid_input",
      `${line}'s plan has ${steps.length} step${steps.length === 1 ? "" : "s"}, so there is no step ${step}`,
      `Run \`octo line show ${line}\` to see the plan, or set it with \`octo plan set ${line}\`.`,
    );
  }
}

export const lineOps = [
  bind(contracts.lineAdd, (ctx, input) => {
    requireDeveloper(ctx, "add a line");
    if (input.where === "tabled" && input.reason === undefined) {
      throw new OctoError("invalid_input", "A tabled line needs a reason", 'Pass --reason "<why not now>".');
    }
    const line = insertLine(ctx, {
      title: input.title,
      doneWhen: input.doneWhen,
      repos: checkRepos(ctx, input.repos),
      state: input.where,
      tabledReason: input.where === "tabled" ? (input.reason ?? null) : null,
      lookAgainAt: input.where === "tabled" ? (input.lookAgainAt ?? null) : null,
      proposedBy: null,
      recommendation: null,
      recommendationWhy: null,
    });
    emitLine(ctx, "line.added", line, `${line.ref} added, ${line.state.replace("_", " ")}: ${line.title}`);
    afterAdd(ctx, line);
    return line;
  }),

  bind(contracts.linePropose, (ctx, input) => {
    if (input.place !== undefined) requireDeveloper(ctx, `${input.place} a line`);
    const line = insertLine(ctx, {
      title: input.title,
      doneWhen: input.doneWhen,
      repos: checkRepos(ctx, input.repos),
      state: input.place === undefined ? "proposed" : PLACE_STATE[input.place],
      tabledReason: null,
      lookAgainAt: null,
      proposedBy: ctx.actor,
      recommendation: input.recommendation,
      recommendationWhy: input.why,
    });
    emitLine(ctx, "line.proposed", line, `${line.ref} proposed by ${ctx.actor}: ${line.title}`);
    afterAdd(ctx, line);
    return line;
  }),

  bind(contracts.lineStart, (ctx, input) => move(ctx, input.ref, "start")),
  bind(contracts.lineQueue, (ctx, input) => move(ctx, input.ref, "queue")),
  bind(contracts.lineTable, (ctx, input) =>
    move(ctx, input.ref, "table", { tabledReason: input.reason, lookAgainAt: input.lookAgainAt ?? null }),
  ),
  bind(contracts.lineDone, (ctx, input) => move(ctx, input.ref, "done")),
  bind(contracts.lineDrop, (ctx, input) => move(ctx, input.ref, "drop")),
  bind(contracts.lineReject, (ctx, input) => move(ctx, input.ref, "reject")),

  bind(contracts.lineFold, (ctx, input) => {
    requireDeveloper(ctx, "fold a line");
    const current = requireLine(ctx, input.ref);
    const into = requireLine(ctx, input.into);
    if (current.ref === into.ref) throw new OctoError("invalid_input", "A line cannot fold into itself");
    if (ENDED.has(current.state)) throw new OctoError("conflict", `${current.ref} already ended`);
    if (ENDED.has(into.state)) {
      throw new OctoError("conflict", `${into.ref} already ended`, "Fold into a line that is still open.");
    }
    const issues = rows(ctx, IssueRow, "SELECT * FROM issues WHERE line = ?", [current.ref]);
    for (const issue of issues) {
      const changes = applyPatch(ctx, "issues", issue.ref, issue, { line: into.ref, step: null });
      emit(ctx, {
        type: "issue.updated",
        kind: "issue",
        ref: issue.ref,
        project: issue.project,
        line: into.ref,
        summary: `${issue.ref} moved from ${current.ref} to ${into.ref}: ${issue.title}`,
        attrs: { status: issue.status },
        changes,
      });
    }
    ctx.sql.run("UPDATE decisions SET line = ? WHERE line = ?", [into.ref, current.ref]);
    setRepos(ctx, into.ref, [...new Set([...into.repos, ...current.repos])]);
    const changes = applyPatch(ctx, "lines", current.ref, current, { state: "dropped" });
    const folded = requireLine(ctx, current.ref);
    afterMove(ctx, current, folded);
    emitLine(ctx, "line.folded", folded, `${folded.ref} folded into ${into.ref}: ${folded.title}`, changes, [
      into.ref,
    ]);
    return folded;
  }),

  bind(contracts.lineOrder, (ctx, input) => {
    requireDeveloper(ctx, "reorder lines");
    const current = requireLine(ctx, input.ref);
    if (ENDED.has(current.state))
      throw new OctoError("conflict", `${current.ref} already ended, so it has no place`);
    const rank = targetRank(ctx, current, input);
    const changes = applyPatch(ctx, "lines", current.ref, current, { rank });
    const updated = requireLine(ctx, current.ref);
    if (Object.keys(changes).length > 0) {
      emitLine(
        ctx,
        "line.reordered",
        updated,
        `${updated.ref} moved within ${updated.state.replace("_", " ")}`,
      );
    }
    return updated;
  }),

  bind(contracts.lineShow, (ctx, input) => {
    const line = requireLine(ctx, input.ref);
    const issues = rows(
      ctx,
      IssueRow,
      "SELECT * FROM issues WHERE line = ? ORDER BY step IS NULL, step, createdAt",
      [line.ref],
    ).map((value) => summarize({ kind: "issue", value }));
    return { line, steps: planOf(ctx, line.ref), issues };
  }),

  bind(contracts.lineList, (ctx, input) => {
    const all = allLines(ctx).map((value) => ({ kind: "line" as const, value }));
    return filterEntities(ctx, all, input.query, loadGraph(ctx))
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),

  bind(contracts.homeShow, (ctx) => {
    const lines = allLines(ctx);
    const inState = (state: LineState) => lines.filter((line) => line.state === state);
    const since = Date.parse(ctx.now) - DONE_LATELY_MS;
    return {
      working: inState("working"),
      upNext: inState("up_next"),
      proposed: inState("proposed"),
      tabled: inState("tabled"),
      doneLately: inState("done")
        .filter((line) => Date.parse(line.updatedAt) >= since)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      crews: Object.fromEntries(
        lines
          .filter((line) => line.state !== "dropped")
          .map((line) => [line.ref, crewOf(ctx, line)] as const)
          .filter(
            ([, crew]) =>
              crew.owner !== null || crew.scoper !== null || crew.helpers.length > 0 || crew.search !== null,
          ),
      ),
    };
  }),

  bind(contracts.planSet, (ctx, input) => {
    const line = requireLine(ctx, input.line);
    guardLineWrite(ctx, line.ref, "scope");
    if (ENDED.has(line.state)) throw new OctoError("conflict", `${line.ref} already ended`);
    const before = new Map(planOf(ctx, line.ref).map((step) => [step.title, step.status]));
    ctx.sql.run("DELETE FROM plan_steps WHERE line = ?", [line.ref]);
    input.steps.forEach((title, index) => {
      ctx.sql.run("INSERT INTO plan_steps (line, position, title, status) VALUES (?, ?, ?, ?)", [
        line.ref,
        index + 1,
        title,
        before.get(title) ?? "todo",
      ]);
    });
    emitLine(ctx, "line.plan_set", line, `${line.ref}'s plan set: ${input.steps.length} steps`);
    return planOf(ctx, line.ref);
  }),
];
