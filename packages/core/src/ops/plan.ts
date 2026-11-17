import { z } from "zod";
import { afterAdd, guardOnLine } from "../agents/claims.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import { branchState, layOut, waitsOn } from "../plan.ts";
import type { Line, LineDetail, LineState, PlanBranch, PlanStep, StepRef } from "../schemas.ts";
import { LineState as LineStateSchema } from "../schemas.ts";
import { applyPatch } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { requireLine } from "../store/entities.ts";
import {
  IssueRow,
  PlanBranchRow,
  type PlanStepRow,
  PlanStepRow as PlanStepRowSchema,
} from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireDeveloper } from "./developer.ts";
import { emitLine, insertLine } from "./lines.ts";

const ENDED: ReadonlySet<LineState> = new Set(["done", "dropped"]);

const BecameRow = z.object({ ref: z.string(), title: z.string(), state: LineStateSchema });
const BranchOfRow = z.object({ branchOf: z.number().int().nullable() });
const MaxRow = z.object({ n: z.number().int().nullable() });

/** A line's plan as stored, and as read: every step and branch with its address, in the tree's order. */
export interface LoadedPlan {
  stepRows: PlanStepRow[];
  branchRows: z.infer<typeof PlanBranchRow>[];
  steps: PlanStep[];
  branches: PlanBranch[];
}

export function loadPlan(ctx: Ctx, line: string): LoadedPlan {
  const stepRows = rows(ctx, PlanStepRowSchema, "SELECT * FROM plan_steps WHERE line = ? ORDER BY ord, id", [
    line,
  ]);
  const branchRows = rows(ctx, PlanBranchRow, "SELECT * FROM plan_branches WHERE line = ? ORDER BY id", [
    line,
  ]);
  const layout = layOut(stepRows, branchRows);
  const byId = new Map(stepRows.map((row) => [row.id, row]));
  const steps = layout.order.flatMap((id) => {
    const row = byId.get(id);
    const address = layout.stepAddress.get(id);
    if (row === undefined || address === undefined) return [];
    return [
      {
        id: row.id,
        line: row.line,
        branch: row.branch,
        position: row.position,
        address,
        title: row.title,
        status: row.status,
      },
    ];
  });
  const branches = branchRows.flatMap((row): PlanBranch[] => {
    const address = layout.branchAddress.get(row.id);
    if (address === undefined) return [];
    const became =
      row.became === null
        ? null
        : (one(ctx, BecameRow, "SELECT ref, title, state FROM lines WHERE ref = ?", [row.became]) ?? null);
    return [
      {
        id: row.id,
        line: row.line,
        fromStep: row.fromStep,
        position: row.position,
        address,
        title: row.title,
        holdsUp: row.holdsUp === null ? null : (layout.stepAddress.get(row.holdsUp) ?? null),
        became,
        state: branchState(
          stepRows.filter((step) => step.branch === row.id),
          became?.state ?? null,
        ),
      },
    ];
  });
  const order = new Map(layout.order.map((id, index) => [id, index]));
  branches.sort(
    (a, b) => (order.get(a.fromStep) ?? 0) - (order.get(b.fromStep) ?? 0) || a.position - b.position,
  );
  return { stepRows, branchRows, steps, branches };
}

/** Keeps each step's place in the tree read top to bottom, for ordering issues by plan in SQL. */
function relayout(ctx: Ctx, line: string): void {
  const plan = loadPlan(ctx, line);
  plan.steps.forEach((step, index) => {
    ctx.sql.run("UPDATE plan_steps SET ord = ? WHERE id = ?", [index + 1, step.id]);
  });
}

function addressOf(ref: StepRef): string {
  return typeof ref === "number" ? String(ref) : ref.trim().toLowerCase();
}

/** A step of a line's plan by its address, or a refusal that says how to see the plan. */
function requireStep(
  plan: LoadedPlan,
  line: string,
  ref: StepRef,
  code: "not_found" | "invalid_input",
): PlanStep {
  const address = addressOf(ref);
  const step = plan.steps.find((candidate) => candidate.address === address);
  if (step === undefined) {
    throw new OctoError(
      code,
      `${line}'s plan has no step ${address}`,
      `See its plan with \`octo plan show ${line}\`.`,
    );
  }
  return step;
}

function requireBranch(plan: LoadedPlan, line: string, address: string): PlanBranch {
  const wanted = address.trim().toLowerCase();
  const branch = plan.branches.find((candidate) => candidate.address === wanted);
  if (branch === undefined) {
    throw new OctoError(
      "not_found",
      `${line}'s plan has no branch ${wanted}`,
      `See its plan with \`octo plan show ${line}\`.`,
    );
  }
  return branch;
}

/** The step an issue names on its line, by id; none when it names none. */
export function stepFor(ctx: Ctx, line: string | null, ref: StepRef | null): number | null {
  if (ref === null) return null;
  if (line === null) {
    throw new OctoError("invalid_input", "A step belongs to a line's plan", "Pass --line as well as --step.");
  }
  return requireStep(loadPlan(ctx, line), line, ref, "invalid_input").id;
}

/** Writing a plan is scoping its line, and only while it has not ended. */
function planLine(ctx: Ctx, ref: string): Line {
  const line = requireLine(ctx, ref);
  guardOnLine(ctx, line.ref, "scope", null);
  if (ENDED.has(line.state)) throw new OctoError("conflict", `${line.ref} already ended`);
  return line;
}

/** A branch holds up a later step of the sequence it forks from, never one before it or elsewhere. */
function checkHoldsUp(
  plan: LoadedPlan,
  line: string,
  from: PlanStep,
  ref: StepRef | null | undefined,
): number | null {
  if (ref === null || ref === undefined) return null;
  const target = requireStep(plan, line, ref, "invalid_input");
  if (target.branch !== from.branch || target.position <= from.position) {
    throw new OctoError(
      "invalid_input",
      `A branch from ${from.address} holds up a later step of the same sequence, not ${target.address}`,
      from.branch === null
        ? `Pick a step after ${from.address} on the critical path, or none.`
        : `Pick a step after ${from.address} on its branch, or none.`,
    );
  }
  return target.id;
}

function insertSteps(
  ctx: Ctx,
  line: string,
  branch: number | null,
  titles: readonly string[],
  from = 1,
): void {
  titles.forEach((title, index) => {
    ctx.sql.run(
      "INSERT INTO plan_steps (line, branch, position, ord, title, status) VALUES (?, ?, ?, 0, ?, 'todo')",
      [line, branch, from + index, title],
    );
  });
}

/**
 * Rewrites one sequence, the critical path or a branch's steps, to these titles. A step whose title stays keeps its id,
 * status, issues and branches; issues on a step that goes move to `orphanStep` (none on the critical path), and branches
 * forking from it move to the step before it, or the first one.
 */
function rewriteSequence(
  ctx: Ctx,
  plan: LoadedPlan,
  line: string,
  branch: number | null,
  titles: readonly string[],
  orphanStep: number | null,
): void {
  const old = plan.stepRows.filter((row) => row.branch === branch).sort((a, b) => a.position - b.position);
  const unused = [...old];
  const fresh: { title: string; position: number }[] = [];
  titles.forEach((title, index) => {
    const match = unused.findIndex((row) => row.title === title);
    const [row] = match === -1 ? [] : unused.splice(match, 1);
    if (row === undefined) {
      fresh.push({ title, position: index + 1 });
      return;
    }
    ctx.sql.run("UPDATE plan_steps SET position = ? WHERE id = ?", [index + 1, row.id]);
  });
  for (const step of fresh) insertSteps(ctx, line, branch, [step.title], step.position);
  const now = rows(
    ctx,
    PlanStepRowSchema,
    `SELECT * FROM plan_steps WHERE line = ? AND branch IS ? ORDER BY position`,
    [line, branch],
  );
  for (const gone of unused) {
    ctx.sql.run("UPDATE issues SET step = ? WHERE step = ?", [orphanStep, gone.id]);
    // Its branches move to the nearest step before it that stays, else the first step.
    const before = old.slice(0, old.indexOf(gone)).reverse();
    const target = before.find((row) => !unused.includes(row))?.id ?? now[0]?.id ?? null;
    if (target === null) {
      ctx.sql.run("DELETE FROM plan_branches WHERE fromStep = ?", [gone.id]);
    } else {
      const last =
        one(ctx, MaxRow, "SELECT MAX(position) AS n FROM plan_branches WHERE fromStep = ?", [target])?.n ?? 0;
      const moving = plan.branchRows.filter((row) => row.fromStep === gone.id);
      moving.forEach((row, index) => {
        ctx.sql.run("UPDATE plan_branches SET fromStep = ?, position = ? WHERE id = ?", [
          target,
          last + index + 1,
          row.id,
        ]);
      });
    }
    ctx.sql.run("UPDATE plan_branches SET holdsUp = NULL WHERE holdsUp = ?", [gone.id]);
    ctx.sql.run("DELETE FROM plan_steps WHERE id = ?", [gone.id]);
  }
  // A branch that now holds up a step at or before the one it forks from holds nothing up.
  const position = new Map(now.map((row) => [row.id, row.position]));
  for (const row of rows(ctx, PlanBranchRow, "SELECT * FROM plan_branches WHERE line = ?", [line])) {
    const from = position.get(row.fromStep);
    const held = row.holdsUp === null ? undefined : position.get(row.holdsUp);
    if (from !== undefined && held !== undefined && held <= from) {
      ctx.sql.run("UPDATE plan_branches SET holdsUp = NULL WHERE id = ?", [row.id]);
    }
  }
}

/** Every branch under this one, at any depth, with this one first. */
function branchFamily(plan: LoadedPlan, branch: number): number[] {
  const family = [branch];
  for (let index = 0; index < family.length; index += 1) {
    const current = family[index];
    const steps = plan.stepRows.filter((row) => row.branch === current).map((row) => row.id);
    for (const child of plan.branchRows) {
      if (steps.includes(child.fromStep) && !family.includes(child.id)) family.push(child.id);
    }
  }
  return family;
}

const STATUS_WORDS = { todo: "to do", doing: "under way", done: "done" } as const;

/** The line a plan branch grew out of, and the step there that waits for it. */
export function branchOfLine(ctx: Ctx, line: string): LineDetail["branchOf"] {
  const branchId =
    one(ctx, BranchOfRow, "SELECT branchOf FROM lines WHERE ref = ?", [line])?.branchOf ?? null;
  if (branchId === null) return null;
  const row = one(ctx, PlanBranchRow, "SELECT * FROM plan_branches WHERE id = ?", [branchId]);
  if (row === null) return null;
  const parent = requireLine(ctx, row.line);
  const plan = loadPlan(ctx, parent.ref);
  const branch = plan.branches.find((candidate) => candidate.id === branchId);
  if (branch === undefined) return null;
  const held =
    branch.holdsUp === null ? undefined : plan.steps.find((step) => step.address === branch.holdsUp);
  return {
    line: parent.ref,
    title: parent.title,
    address: branch.address,
    holdsUp: held === undefined ? null : { address: held.address, title: held.title },
  };
}

export const planOps = [
  bind(contracts.planSet, (ctx, input) => {
    const line = planLine(ctx, input.line);
    rewriteSequence(ctx, loadPlan(ctx, line.ref), line.ref, null, input.steps, null);
    relayout(ctx, line.ref);
    emitLine(ctx, "line.plan_set", line, `${line.ref}'s plan set: ${input.steps.length} steps`);
    return loadPlan(ctx, line.ref).steps;
  }),

  bind(contracts.planStep, (ctx, input) => {
    const line = planLine(ctx, input.line);
    const plan = loadPlan(ctx, line.ref);
    const step = requireStep(plan, line.ref, input.step, "not_found");
    const waiting = waitsOn(step, plan.branches);
    if (input.status === "done" && waiting.length > 0) {
      const names = plan.branches
        .filter((branch) => waiting.includes(branch.became?.ref ?? branch.address))
        .map((branch) =>
          branch.became === null
            ? `${branch.address}, ${branch.title}`
            : `${branch.became.ref}, ${branch.became.title}`,
        );
      throw new OctoError(
        "conflict",
        `Step ${step.address} waits on ${names.join(" and ")}`,
        "Finish what it waits on, or set that branch to hold nothing up.",
      );
    }
    ctx.sql.run("UPDATE plan_steps SET status = ? WHERE id = ?", [input.status, step.id]);
    emitLine(
      ctx,
      "line.step_set",
      line,
      `${line.ref} step ${step.address} ${STATUS_WORDS[input.status]}: ${step.title}`,
    );
    return loadPlan(ctx, line.ref).steps;
  }),

  bind(contracts.planBranch, (ctx, input) => {
    const line = planLine(ctx, input.line);
    const plan = loadPlan(ctx, line.ref);
    const from = requireStep(plan, line.ref, input.from, "invalid_input");
    const holdsUp = checkHoldsUp(plan, line.ref, from, input.holdsUp);
    const last =
      one(ctx, MaxRow, "SELECT MAX(position) AS n FROM plan_branches WHERE fromStep = ?", [from.id])?.n ?? 0;
    ctx.sql.run(
      "INSERT INTO plan_branches (line, fromStep, holdsUp, position, title) VALUES (?, ?, ?, ?, ?)",
      [line.ref, from.id, holdsUp, last + 1, input.title],
    );
    const id = one(ctx, MaxRow, "SELECT MAX(id) AS n FROM plan_branches WHERE line = ?", [line.ref])?.n ?? 0;
    insertSteps(ctx, line.ref, id, input.steps);
    relayout(ctx, line.ref);
    const added = loadPlan(ctx, line.ref).branches.find((branch) => branch.id === id);
    emitLine(
      ctx,
      "line.branch_added",
      line,
      `${line.ref} branch ${added?.address ?? ""}: ${input.title}${added?.holdsUp === null || added === undefined ? "" : `, holds up step ${added.holdsUp}`}`,
    );
    return loadPlan(ctx, line.ref).branches;
  }),

  bind(contracts.planBranchUpdate, (ctx, input) => {
    const line = planLine(ctx, input.line);
    const plan = loadPlan(ctx, line.ref);
    const branch = requireBranch(plan, line.ref, input.branch);
    if (input.steps !== undefined && branch.became !== null) {
      throw new OctoError(
        "conflict",
        `${branch.address} became ${branch.became.ref}`,
        `Its steps are that line's plan now.`,
      );
    }
    if (input.title !== undefined) {
      ctx.sql.run("UPDATE plan_branches SET title = ? WHERE id = ?", [input.title, branch.id]);
    }
    if (input.holdsUp !== undefined) {
      const from = plan.steps.find((step) => step.id === branch.fromStep);
      if (from === undefined) throw new OctoError("conflict", `${branch.address} forks from no step`);
      ctx.sql.run("UPDATE plan_branches SET holdsUp = ? WHERE id = ?", [
        checkHoldsUp(plan, line.ref, from, input.holdsUp),
        branch.id,
      ]);
    }
    if (input.steps !== undefined)
      rewriteSequence(ctx, plan, line.ref, branch.id, input.steps, branch.fromStep);
    relayout(ctx, line.ref);
    emitLine(
      ctx,
      "line.branch_changed",
      line,
      `${line.ref} branch ${branch.address} changed: ${input.title ?? branch.title}`,
    );
    return loadPlan(ctx, line.ref).branches;
  }),

  bind(contracts.planBranchRemove, (ctx, input) => {
    const line = planLine(ctx, input.line);
    const plan = loadPlan(ctx, line.ref);
    const branch = requireBranch(plan, line.ref, input.branch);
    const family = branchFamily(plan, branch.id);
    const steps = plan.stepRows
      .filter((row) => row.branch !== null && family.includes(row.branch))
      .map((row) => row.id);
    for (const step of steps) {
      ctx.sql.run("UPDATE issues SET step = ? WHERE step = ?", [branch.fromStep, step]);
      ctx.sql.run("DELETE FROM plan_steps WHERE id = ?", [step]);
    }
    for (const id of family) {
      ctx.sql.run("UPDATE lines SET branchOf = NULL WHERE branchOf = ?", [id]);
      ctx.sql.run("DELETE FROM plan_branches WHERE id = ?", [id]);
    }
    relayout(ctx, line.ref);
    emitLine(
      ctx,
      "line.branch_removed",
      line,
      `${line.ref} branch ${branch.address} removed: ${branch.title}`,
    );
    return loadPlan(ctx, line.ref).branches;
  }),

  bind(contracts.planPromote, (ctx, input) => {
    const line = planLine(ctx, input.line);
    const plan = loadPlan(ctx, line.ref);
    const branch = requireBranch(plan, line.ref, input.branch);
    if (branch.became !== null) {
      throw new OctoError("conflict", `${branch.address} already became ${branch.became.ref}`);
    }
    const where = input.where ?? "up_next";
    if (ctx.developer && where === "tabled" && input.reason === undefined) {
      throw new OctoError("invalid_input", "A tabled line needs a reason", 'Pass --reason "<why not now>".');
    }
    if (!ctx.developer && input.where !== undefined) requireDeveloper(ctx, "place a line");
    const created = insertLine(ctx, {
      title: input.title ?? branch.title,
      doneWhen: input.doneWhen,
      repos: line.repos,
      state: ctx.developer ? where : "proposed",
      tabledReason: ctx.developer && where === "tabled" ? (input.reason ?? null) : null,
      lookAgainAt: null,
      proposedBy: ctx.developer ? null : ctx.actor,
      recommendation: ctx.developer ? null : (input.recommendation ?? "up_next"),
      recommendationWhy: ctx.developer
        ? null
        : (input.why ?? `It grew out of branch ${branch.address} of ${line.ref}, ${line.title}.`),
    });
    // Its steps become the new line's critical path, and every branch under it goes along with its steps.
    const family = branchFamily(plan, branch.id);
    const moved = plan.stepRows.filter((row) => row.branch !== null && family.includes(row.branch));
    for (const row of moved) {
      ctx.sql.run("UPDATE plan_steps SET line = ?, branch = ? WHERE id = ?", [
        created.ref,
        row.branch === branch.id ? null : row.branch,
        row.id,
      ]);
    }
    for (const id of family.slice(1))
      ctx.sql.run("UPDATE plan_branches SET line = ? WHERE id = ?", [created.ref, id]);
    const ids = moved.map((row) => row.id);
    if (ids.length > 0) {
      const issues = rows(
        ctx,
        IssueRow,
        `SELECT * FROM issues WHERE step IN (${ids.map(() => "?").join(", ")})`,
        ids,
      );
      for (const issue of issues) applyPatch(ctx, "issues", issue.ref, issue, { line: created.ref });
    }
    ctx.sql.run("UPDATE plan_branches SET became = ? WHERE id = ?", [created.ref, branch.id]);
    ctx.sql.run("UPDATE lines SET branchOf = ? WHERE ref = ?", [branch.id, created.ref]);
    relayout(ctx, line.ref);
    relayout(ctx, created.ref);
    const placed = requireLine(ctx, created.ref);
    emitLine(
      ctx,
      ctx.developer ? "line.added" : "line.proposed",
      placed,
      ctx.developer
        ? `${placed.ref} added, ${placed.state.replace("_", " ")}: ${placed.title}, from branch ${branch.address} of ${line.ref}`
        : `${placed.ref} proposed by ${ctx.actor}: ${placed.title}, from branch ${branch.address} of ${line.ref}`,
    );
    emitLine(
      ctx,
      "line.branch_promoted",
      line,
      `${line.ref} branch ${branch.address} became ${placed.ref}: ${placed.title}`,
      undefined,
      [placed.ref],
    );
    afterAdd(ctx, placed);
    return placed;
  }),
];
