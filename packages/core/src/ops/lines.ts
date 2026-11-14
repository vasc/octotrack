import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { EventAttrs, Line, LinePlacement, LineState, PlanStep } from "../schemas.ts";
import type { EventTypeName } from "../query/values.ts";
import { applyPatch, type Changes, emit, nextNumber } from "../store/common.ts";
import { rankAtEnd } from "../store/ranks.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { allLines, requireLine, requireProject, summarize } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { IssueRow, PlanStepRow, PrRow } from "../store/rows.ts";
import { afterAdd, afterMove, guardLineWrite, guardOnLine, windDown } from "../agents/claims.ts";
import { DEVELOPER } from "../agents/state.ts";
import { addNotice, claimOf } from "../store/agents.ts";
import { addToInbox } from "../store/inbox.ts";
import { bind } from "./bind.ts";
import { LOG_SEEN_KEY } from "./feed.ts";
import { buildHome } from "./home.ts";
import { requireDeveloper, requireDeveloperInPerson } from "./developer.ts";

/** Below this gap two ranks are too close to split again, so the section is renumbered. */
const SMALLEST_GAP = 1e-6;

const ENDED: ReadonlySet<LineState> = new Set(["done", "dropped"]);

/** Only the owner speaks for the line: its summary and its case for done. The developer may too. */
function requireOwner(ctx: Ctx, line: Line, what: string): void {
  if (ctx.developer) return;
  const claim = claimOf(ctx, ctx.actor);
  if (claim === null || claim.line !== line.ref || claim.role !== "owner") {
    throw new OctoError(
      "forbidden",
      `Only ${line.ref}'s owner may ${what}`,
      "Helpers report to the owner instead.",
    );
  }
}

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
  type: EventTypeName,
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
  // A line the developer adds names its repos, or is theirs: with no repo, no agent could work on it.
  if (input.repos.length === 0 && input.proposedBy === null) {
    ctx.sql.run("UPDATE lines SET ownedBy = 'dev' WHERE ref = ?", [ref]);
  }
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
    // A case for done is about the line as it was; once it moves, it is answered.
    doneProposal: current.state === rule.to ? undefined : null,
    doneProposedBy: current.state === rule.to ? undefined : null,
    // Urgent is a proposal's: placed, the line is in the developer's order like any other.
    urgentReason: current.state === rule.to ? undefined : null,
  });
  const updated = requireLine(ctx, current.ref);
  afterMove(ctx, current, updated, name === "reject" ? "said it is not a line" : undefined);
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
    if (input.urgent !== undefined) {
      ctx.sql.run("UPDATE lines SET urgentReason = ? WHERE ref = ?", [input.urgent, line.ref]);
    }
    const proposed = requireLine(ctx, line.ref);
    emitLine(
      ctx,
      "line.proposed",
      proposed,
      `${proposed.ref} proposed by ${ctx.actor}${proposed.urgentReason === null ? "" : `, urgent (${proposed.urgentReason.replace("_", " ")})`}: ${proposed.title}`,
    );
    afterAdd(ctx, proposed);
    return proposed;
  }),

  bind(contracts.lineStart, (ctx, input) => move(ctx, input.ref, "start")),
  bind(contracts.lineQueue, (ctx, input) => move(ctx, input.ref, "queue")),
  bind(contracts.lineTable, (ctx, input) =>
    move(ctx, input.ref, "table", { tabledReason: input.reason, lookAgainAt: input.lookAgainAt ?? null }),
  ),
  bind(contracts.lineDone, (ctx, input) => move(ctx, input.ref, "done")),
  bind(contracts.lineDrop, (ctx, input) => move(ctx, input.ref, "drop")),
  bind(contracts.lineReject, (ctx, input) => {
    requireDeveloper(ctx, "say a proposal is not a line");
    const line = requireLine(ctx, input.ref);
    if (line.state === "proposed") {
      // Not a line ends the work made for it, and returns older work to no line, where drift asks for a home for it.
      for (const issue of rows(
        ctx,
        IssueRow,
        "SELECT * FROM issues WHERE line = ? AND status NOT IN ('done', 'cancelled')",
        [line.ref],
      )) {
        const madeForIt =
          line.proposedBy !== null &&
          issue.createdBy === line.proposedBy &&
          issue.createdAt >= line.createdAt;
        const changes = applyPatch(
          ctx,
          "issues",
          issue.ref,
          issue,
          madeForIt
            ? { status: "cancelled", closedAt: ctx.now }
            : {
                line: null,
                step: null,
                assignee: null,
                status: issue.status === "in_progress" ? "todo" : undefined,
              },
        );
        if (!madeForIt) {
          // Attested, as D6 attests drift: this work was offered as a line and turned down, so it is not asked about again.
          ctx.sql.run("INSERT OR REPLACE INTO not_a_line (issue, line, at) VALUES (?, ?, ?)", [
            issue.ref,
            line.ref,
            ctx.now,
          ]);
        }
        emit(ctx, {
          type: madeForIt ? "issue.status_changed" : "issue.updated",
          kind: "issue",
          ref: issue.ref,
          project: issue.project,
          line: line.ref,
          summary: madeForIt
            ? `${issue.ref} closed: ${line.ref} is not a line`
            : `${issue.ref} is on no line again: ${line.ref} is not a line`,
          attrs: { status: madeForIt ? "cancelled" : issue.status },
          changes,
        });
      }
    }
    return move(ctx, line.ref, "reject");
  }),

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
    // Answers and Tells waiting for the folded line go where its work went.
    ctx.sql.run("UPDATE line_inbox SET line = ? WHERE line = ? AND deliveredAt IS NULL", [
      into.ref,
      current.ref,
    ]);
    setRepos(ctx, into.ref, [...new Set([...into.repos, ...current.repos])]);
    const changes = applyPatch(ctx, "lines", current.ref, current, { state: "dropped" });
    const folded = requireLine(ctx, current.ref);
    afterMove(ctx, current, folded, `folded it into ${into.ref}`);
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
    );
    const prsOf = (issue: string) =>
      rows(
        ctx,
        PrRow,
        `SELECT p.* FROM prs p JOIN links k ON k.fromRef = p.ref AND k.rel = 'implements' WHERE k.toRef = ?
         ORDER BY p.number`,
        [issue],
      ).map((pr) => ({ ref: pr.ref, repo: pr.repo, number: pr.number, state: pr.state, checks: pr.checks }));
    return {
      line,
      steps: planOf(ctx, line.ref),
      issues: issues.map((value) => summarize({ kind: "issue", value })),
      work: issues.map((issue) => ({
        ref: issue.ref,
        title: issue.title,
        status: issue.status,
        step: issue.step,
        assignee: issue.assignee,
        prs: prsOf(issue.ref),
      })),
    };
  }),

  bind(contracts.lineList, (ctx, input) => {
    const all = allLines(ctx).map((value) => ({ kind: "line" as const, value }));
    return filterEntities(ctx, all, input.query, loadGraph(ctx))
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),

  bind(contracts.homeShow, (ctx) => buildHome(ctx)),

  bind(contracts.planSet, (ctx, input) => {
    const line = requireLine(ctx, input.line);
    guardOnLine(ctx, line.ref, "scope", null);
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

  bind(contracts.lineSummarize, (ctx, input) => {
    const line = requireLine(ctx, input.ref);
    requireOwner(ctx, line, "write its summary");
    guardLineWrite(ctx, line.ref, "scope");
    const changes = applyPatch(ctx, "lines", line.ref, line, {
      headline: input.headline,
      summary: input.summary,
      summaryAt: ctx.now,
    });
    const updated = requireLine(ctx, line.ref);
    emitLine(ctx, "line.summarized", updated, `${updated.ref}: ${input.headline}`, changes);
    return updated;
  }),

  bind(contracts.lineDoneWhen, (ctx, input) => {
    const line = requireLine(ctx, input.ref);
    if (ctx.developer) {
      const changes = applyPatch(ctx, "lines", line.ref, line, {
        doneWhen: input.doneWhen,
        doneWhenProposal: null,
        doneWhenProposedBy: null,
        doneWhenWhy: null,
      });
      const updated = requireLine(ctx, line.ref);
      emitLine(ctx, "line.done_when_set", updated, `${updated.ref} is done when: ${input.doneWhen}`, changes);
      return updated;
    }
    const claim = claimOf(ctx, ctx.actor);
    const mayPropose =
      (claim !== null && claim.line === line.ref && claim.role !== "helper") || line.proposedBy === ctx.actor;
    if (!mayPropose) {
      throw new OctoError(
        "forbidden",
        `Only ${line.ref}'s owner or scoper proposes its done when`,
        `Take it first: octo line take ${line.ref}`,
      );
    }
    guardLineWrite(ctx, line.ref, "scope");
    // A proposed line's done when is still its agent's own words, so it writes it directly. Any other line's is the
    // developer's to accept: on a working line as an item for them, on a waiting one in its Start sheet.
    const direct = line.state === "proposed";
    const changes = applyPatch(
      ctx,
      "lines",
      line.ref,
      line,
      direct
        ? { doneWhen: input.doneWhen }
        : { doneWhenProposal: input.doneWhen, doneWhenProposedBy: ctx.actor, doneWhenWhy: input.why ?? null },
    );
    const updated = requireLine(ctx, line.ref);
    emitLine(
      ctx,
      direct ? "line.done_when_set" : "line.done_when_proposed",
      updated,
      `${updated.ref} ${direct ? "is done when" : "could be done when"}: ${input.doneWhen}`,
      changes,
    );
    return updated;
  }),

  bind(contracts.lineDoneWhenAnswer, (ctx, input) => {
    requireDeveloper(ctx, "answer a proposed done when");
    const line = requireLine(ctx, input.ref);
    if (line.doneWhenProposal === null)
      throw new OctoError("conflict", `${line.ref} has no proposed done when`);
    const changes = applyPatch(ctx, "lines", line.ref, line, {
      ...(input.accept ? { doneWhen: line.doneWhenProposal } : {}),
      doneWhenProposal: null,
      doneWhenProposedBy: null,
      doneWhenWhy: null,
    });
    if (line.doneWhenProposedBy !== null) {
      addNotice(
        ctx,
        line.doneWhenProposedBy,
        "done_when",
        line.ref,
        input.accept
          ? `${line.ref} is now done when: ${line.doneWhenProposal}`
          : `${line.ref} keeps its done when: ${line.doneWhen}`,
        false,
      );
    }
    const updated = requireLine(ctx, line.ref);
    emitLine(
      ctx,
      input.accept ? "line.done_when_set" : "line.done_when_kept",
      updated,
      input.accept
        ? `${updated.ref} is done when: ${updated.doneWhen}`
        : `${updated.ref} keeps its done when`,
      changes,
    );
    return updated;
  }),

  bind(contracts.lineProposeDone, (ctx, input) => {
    const line = requireLine(ctx, input.ref);
    requireOwner(ctx, line, "propose it is done");
    if (line.state !== "working") throw new OctoError("conflict", `${line.ref} is not being worked on`);
    const changes = applyPatch(ctx, "lines", line.ref, line, {
      doneProposal: input.why,
      doneProposedBy: ctx.actor,
    });
    const updated = requireLine(ctx, line.ref);
    emitLine(ctx, "line.done_proposed", updated, `${updated.ref} could be done: ${input.why}`, changes);
    return updated;
  }),

  bind(contracts.lineNotYet, (ctx, input) => {
    requireDeveloper(ctx, "say a line is not done");
    const line = requireLine(ctx, input.ref);
    if (line.doneProposal === null) throw new OctoError("conflict", `Nobody proposed ${line.ref} is done`);
    const changes = applyPatch(ctx, "lines", line.ref, line, { doneProposal: null, doneProposedBy: null });
    // To the line, not the proposer: whoever owns it now hears what is missing, and is woken by it.
    addToInbox(
      ctx,
      line.ref,
      "not_yet",
      line.ref,
      null,
      `${line.ref} is not done yet${input.why === undefined ? "" : `: ${input.why}`}`,
    );
    const updated = requireLine(ctx, line.ref);
    emitLine(
      ctx,
      "line.not_yet",
      updated,
      `${updated.ref} is not done yet${input.why === undefined ? "" : `: ${input.why}`}`,
      changes,
    );
    return updated;
  }),

  bind(contracts.lineOwn, (ctx, input) => {
    requireDeveloper(ctx, "own a line");
    const line = requireLine(ctx, input.ref);
    if (line.state !== "working") {
      throw new OctoError("conflict", `${line.ref} is not being worked on`, "Start it first, then own it.");
    }
    if (line.ownedBy !== null) return line;
    const changes = applyPatch(ctx, "lines", line.ref, line, { ownedBy: DEVELOPER });
    const updated = requireLine(ctx, line.ref);
    windDown(ctx, updated, true);
    emitLine(
      ctx,
      "line.owned",
      updated,
      `${updated.ref} is the developer's own now: ${updated.title}`,
      changes,
    );
    return updated;
  }),

  bind(contracts.lineHand, (ctx, input) => {
    requireDeveloper(ctx, "hand a line to the agents");
    const line = requireLine(ctx, input.ref);
    if (line.ownedBy === null) throw new OctoError("conflict", `${line.ref} is not the developer's own`);
    if (input.repos !== undefined) setRepos(ctx, line.ref, checkRepos(ctx, input.repos));
    const changes = applyPatch(ctx, "lines", line.ref, line, { ownedBy: null });
    const updated = requireLine(ctx, line.ref);
    if (updated.repos.length === 0) {
      throw new OctoError(
        "invalid_input",
        `${line.ref} names no repo, so no agent could take it`,
        "Pass --repo <KEY>.",
      );
    }
    afterAdd(ctx, updated);
    emitLine(
      ctx,
      "line.handed",
      updated,
      `${updated.ref} is back with the agents: ${updated.title}`,
      changes,
    );
    return updated;
  }),

  bind(contracts.lineAcceptRecommended, (ctx, input) => {
    requireDeveloper(ctx, "place proposals");
    return input.refs.flatMap((ref): Line[] => {
      const line = requireLine(ctx, ref);
      if (line.state !== "proposed") return [];
      switch (line.recommendation) {
        case "start":
          return [move(ctx, line.ref, "start")];
        case "up_next":
          return [move(ctx, line.ref, "queue")];
        case "table":
          return [
            move(ctx, line.ref, "table", {
              tabledReason: line.recommendationWhy ?? "Its agent recommended it",
            }),
          ];
        default:
          // A fold needs the line to fold into, and no advice needs the developer's own call.
          return [];
      }
    });
  }),

  bind(contracts.seen, (ctx, input) => {
    // What the developer has seen, only they can say: marked on an agent's word, it would be hidden from them.
    requireDeveloperInPerson(ctx, "mark lines as seen");
    const where = input.line === undefined ? "" : " WHERE ref = ?";
    const params = input.line === undefined ? [ctx.now] : [ctx.now, requireLine(ctx, input.line).ref];
    const count = input.line === undefined ? allLines(ctx).length : 1;
    ctx.sql.run(`UPDATE lines SET seenAt = ?${where}`, params);
    if (input.line === undefined) {
      ctx.sql.run(
        "INSERT INTO developer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [LOG_SEEN_KEY, ctx.now],
      );
    }
    ctx.visibleChange = true;
    return { lines: count };
  }),
];
