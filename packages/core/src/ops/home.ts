import { z } from "zod";
import { crewOf, waitingOnYou } from "../agents/claims.ts";
import { DEVELOPER } from "../agents/state.ts";
import {
  currentStep,
  type ForYou,
  type HomeView,
  type Line,
  type LineHome,
  type LineState,
} from "../schemas.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { allLines } from "../store/entities.ts";
import { DecisionRow, IssueRow } from "../store/rows.ts";
import { waitsOn } from "../plan.ts";
import { branchOfLine, loadPlan } from "./plan.ts";
import { buildQueue } from "./decisions.ts";
import { lineStart, runnerStatus, stepInFor, stepInKind, stepInReason } from "./runner.ts";
import { atView, freedIssue, heldCount, heldOn, reconfirmingOn } from "./tasks.ts";

const DONE_LATELY_MS = 7 * 24 * 60 * 60 * 1000;
/** How long an answer's status shows on its line. */
const ANSWERS_SHOWN_MS = 3 * 24 * 60 * 60 * 1000;
const ANSWERS_SHOWN = 3;
const DeliveredRow = z.object({
  ref: z.string().nullable(),
  deliveredTo: z.string().nullable(),
  deliveredAt: z.string().nullable(),
});
const GoneRow = z.object({ ref: z.string(), ts: z.string() });

/**
 * The answers given on a line lately, and what became of each: waiting in the line's inbox, heard by an agent (which,
 * and when), carried out as it reported, or waiting after the agent it was for could not be woken.
 */
function answersOn(ctx: Ctx, line: string): LineHome["answers"] {
  const since = new Date(Date.parse(ctx.now) - ANSWERS_SHOWN_MS).toISOString();
  const delivered = new Map(
    rows(
      ctx,
      DeliveredRow,
      "SELECT ref, deliveredTo, deliveredAt FROM line_inbox WHERE line = ? AND kind = 'answer'",
      [line],
    ).map((row) => [row.ref, row]),
  );
  // Agents on this line that could not be woken, newest first: a wake that fails ends the claim, so the log says who.
  const gone = rows(
    ctx,
    GoneRow,
    "SELECT ref, ts FROM events WHERE type = 'agent.gone' AND line = ? ORDER BY seq DESC",
    [line],
  );
  return rows(
    ctx,
    DecisionRow,
    "SELECT * FROM decisions WHERE line = ? AND status = 'decided' AND decidedAt >= ? ORDER BY decidedAt DESC LIMIT ?",
    [line, since, ANSWERS_SHOWN],
  ).map((decision) => {
    const chosen = decision.options.find((option) => option.key === decision.chosenOption)?.label;
    const inbox = delivered.get(decision.ref);
    const heardAt = inbox?.deliveredAt ?? decision.pickedUpAt;
    const heardBy = inbox?.deliveredAt == null ? decision.pickedUpBy : (inbox.deliveredTo ?? null);
    const unwoken =
      heardAt === null ? (gone.find((event) => event.ts >= (decision.decidedAt ?? ""))?.ref ?? null) : null;
    return {
      ref: decision.ref,
      title: decision.title,
      answer: chosen ?? decision.resolutionNote ?? "answered",
      status:
        decision.reportStatus === "done"
          ? "carried_out"
          : heardAt !== null
            ? "picked_up"
            : unwoken !== null
              ? "wake_failed"
              : "not_picked_up",
      by: heardAt === null ? null : heardBy,
      at: heardAt,
      note: decision.reportStatus === "done" ? decision.reportNote : null,
      unwoken,
    };
  });
}

function openTasks(ctx: Ctx, line: string) {
  return rows(
    ctx,
    IssueRow,
    `SELECT * FROM issues WHERE line = ? AND assignee = ? AND outcome IS NOT NULL AND status NOT IN ('done', 'cancelled')
       AND heldAt IS NULL
     ORDER BY step IS NULL, step, createdAt`,
    [line, DEVELOPER],
  );
}

/**
 * How many changes were logged on a line after a time: what its summary does not yet tell. The same rule as
 * sinceSummaryQuery, which the line's panel lists: not the developer's own doings, and not reorders.
 */
function changesSince(ctx: Ctx, line: string, at: string): number {
  return (
    one(
      ctx,
      z.object({ n: z.number() }),
      "SELECT COUNT(*) AS n FROM events WHERE line = ? AND ts > ? AND actor <> ? AND type <> 'line.reordered'",
      [line, at, DEVELOPER],
    )?.n ?? 0
  );
}

/**
 * The home screen in one read: every line in the developer's order, who is on it, its plan step, and what waits on the
 * developer, so that the page never has to piece a line together from several calls.
 */
export function buildHome(ctx: Ctx): HomeView {
  const lines = allLines(ctx);
  const inState = (state: LineState) => lines.filter((line) => line.state === state);
  const since = Date.parse(ctx.now) - DONE_LATELY_MS;
  const queue = buildQueue(ctx, undefined);
  const urgent = queue.filter(
    (card) => card.decision.urgentReason !== null && card.decision.notUrgentAt === null,
  );
  const crews = Object.fromEntries(
    lines
      .filter((line) => line.state !== "dropped")
      .map((line) => [line.ref, crewOf(ctx, line)] as const)
      .filter(
        ([, crew]) =>
          crew.owner !== null || crew.scoper !== null || crew.helpers.length > 0 || crew.search !== null,
      ),
  );

  const details = (line: Line): LineHome => {
    const plan = loadPlan(ctx, line.ref);
    const steps = plan.steps.filter((step) => step.branch === null);
    const current = currentStep(steps);
    const branchOf = branchOfLine(ctx, line.ref);
    const working = line.state === "working";
    const questions: ForYou[] = working
      ? queue
          .filter((card) => card.decision.line === line.ref && !urgent.includes(card))
          .map((card) => ({ kind: "question", card }))
      : [];
    const tasks: ForYou[] = working
      ? openTasks(ctx, line.ref).map((task) => ({ kind: "task", task, frees: freedIssue(ctx, task.ref) }))
      : [];
    // A proposal about the line itself is its first item: it decides what the rest of it is for.
    const proposals: ForYou[] = working
      ? [
          ...(line.doneProposal === null
            ? []
            : [
                {
                  kind: "done" as const,
                  line: line.ref,
                  text: line.doneProposal,
                  by: line.doneProposedBy,
                  doneWhen: line.doneWhen,
                },
              ]),
          ...(line.doneWhenProposal === null
            ? []
            : [
                {
                  kind: "done_when" as const,
                  line: line.ref,
                  text: line.doneWhenProposal,
                  by: line.doneWhenProposedBy,
                  was: line.doneWhen,
                  why: line.doneWhenWhy,
                },
              ]),
        ]
      : [];
    // A waiting line holds what Start would show: its current items. A line the developer owns holds every question
    // and task its agents left, for an agent to take up when the developer hands it back.
    const owned = line.ownedBy !== null;
    const held = working ? [] : heldOn(ctx, line.ref).filter((item) => item.current);
    return {
      start: lineStart(ctx, line.ref),
      stepIn: stepInFor(ctx, line),
      stepInReason: stepInReason(ctx, line),
      stepInKind: stepInKind(ctx, line),
      waitingOnYou: working && waitingOnYou(ctx, line.ref),
      step:
        current === undefined
          ? null
          : {
              position: current.position,
              of: steps.length,
              title: current.title,
              waitsOn: waitsOn(current, plan.branches),
            },
      branchesOpen: plan.branches.filter((branch) => branch.state === "open").length,
      branchOf:
        branchOf === null
          ? null
          : { line: branchOf.line, address: branchOf.address, holdsUp: branchOf.holdsUp?.address ?? null },
      forYou: [...proposals, ...questions, ...tasks],
      held:
        working && owned
          ? heldCount(ctx, line.ref)
          : {
              questions: held.filter((item) => item.kind === "question").length,
              tasks: held.filter((item) => item.kind === "task").length,
            },
      // Only an agent re-confirms, and none may write to a line the developer owns, so there nothing is re-confirming.
      reconfirming:
        !owned && (line.state === "working" || line.state === "up_next") ? reconfirmingOn(ctx, line.ref) : 0,
      sinceSummary: line.summaryAt === null ? 0 : changesSince(ctx, line.ref, line.summaryAt),
      scopedSteps: steps.length,
      answers: working ? answersOn(ctx, line.ref) : [],
    };
  };

  const open = lines.filter((line) => line.state !== "done" && line.state !== "dropped");
  const lineDetails = Object.fromEntries(open.map((line) => [line.ref, details(line)] as const));
  const working = inState("working");
  // An urgent proposal, for something broken where no agent may work, stands first under Proposed.
  const proposed = inState("proposed").sort(
    (a, b) => Number(b.urgentReason !== null) - Number(a.urgentReason !== null),
  );
  const urgentProposals = proposed.filter((line) => line.urgentReason !== null).length;
  return {
    runner: runnerStatus(ctx),
    at: atView(ctx),
    urgent,
    noLine: queue.filter((card) => card.decision.line === null && !urgent.includes(card)),
    lines: lineDetails,
    counts: {
      toAnswer: queue.length - urgent.length,
      toDo: working.reduce((sum, line) => sum + openTasks(ctx, line.ref).length, 0),
      toAccept:
        inState("proposed").length +
        lines.filter((line) => line.doneWhenProposal !== null || line.doneProposal !== null).length,
      toStepIn: working.filter((line) => lineDetails[line.ref]?.stepIn === true).length,
      urgent: urgent.length + urgentProposals,
    },
    working,
    upNext: inState("up_next"),
    proposed,
    tabled: inState("tabled"),
    doneLately: inState("done")
      .filter((line) => Date.parse(line.updatedAt) >= since)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    crews,
  };
}
