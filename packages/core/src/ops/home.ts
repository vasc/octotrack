import { z } from "zod";
import { crewOf } from "../agents/claims.ts";
import { DEVELOPER } from "../agents/state.ts";
import type { ForYou, HomeView, Line, LineHome, LineState } from "../schemas.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { allLines } from "../store/entities.ts";
import { DecisionRow, IssueRow, PlanStepRow } from "../store/rows.ts";
import { buildQueue } from "./decisions.ts";
import { lineStart, runnerStatus, stepInFor } from "./runner.ts";
import { atView, heldOn } from "./tasks.ts";

const DONE_LATELY_MS = 7 * 24 * 60 * 60 * 1000;
/** How long an answer's status shows on its line. */
const ANSWERS_SHOWN_MS = 3 * 24 * 60 * 60 * 1000;
const ANSWERS_SHOWN = 3;
const DeliveredRow = z.object({ ref: z.string().nullable(), deliveredAt: z.string().nullable() });

/**
 * The answers given on a line lately, and what became of each: waiting in the line's inbox, heard by its agent, carried
 * out as it reported, or a wake that failed while it waited.
 */
function answersOn(ctx: Ctx, line: string): LineHome["answers"] {
  const since = new Date(Date.parse(ctx.now) - ANSWERS_SHOWN_MS).toISOString();
  const delivered = new Map(
    rows(ctx, DeliveredRow, "SELECT ref, deliveredAt FROM line_inbox WHERE line = ? AND kind = 'answer'", [
      line,
    ]).map((row) => [row.ref, row.deliveredAt]),
  );
  const failedWake =
    rows(
      ctx,
      z.object({ name: z.string() }),
      `SELECT a.name AS name FROM agents a JOIN line_claims c ON c.agent = a.name
     WHERE c.line = ? AND a.wakeError IS NOT NULL`,
      [line],
    ).length > 0;
  return rows(
    ctx,
    DecisionRow,
    "SELECT * FROM decisions WHERE line = ? AND status = 'decided' AND decidedAt >= ? ORDER BY decidedAt DESC LIMIT ?",
    [line, since, ANSWERS_SHOWN],
  ).map((decision) => {
    const chosen = decision.options.find((option) => option.key === decision.chosenOption)?.label;
    const heard = delivered.get(decision.ref) ?? null;
    return {
      ref: decision.ref,
      title: decision.title,
      answer: chosen ?? decision.resolutionNote ?? "answered",
      status:
        decision.reportStatus === "done"
          ? "carried_out"
          : heard !== null || decision.pickedUpAt !== null
            ? "picked_up"
            : failedWake
              ? "wake_failed"
              : "not_picked_up",
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
    const steps = rows(ctx, PlanStepRow, "SELECT * FROM plan_steps WHERE line = ? ORDER BY position", [
      line.ref,
    ]);
    const current = steps.find((step) => step.status !== "done");
    const working = line.state === "working";
    const questions: ForYou[] = working
      ? queue
          .filter((card) => card.decision.line === line.ref && !urgent.includes(card))
          .map((card) => ({ kind: "question", card }))
      : [];
    const tasks: ForYou[] = working ? openTasks(ctx, line.ref).map((task) => ({ kind: "task", task })) : [];
    // A proposal about the line itself is its first item: it decides what the rest of it is for.
    const proposals: ForYou[] = working
      ? [
          ...(line.doneProposal === null
            ? []
            : [{ kind: "done" as const, line: line.ref, text: line.doneProposal, by: line.doneProposedBy }]),
          ...(line.doneWhenProposal === null
            ? []
            : [
                {
                  kind: "done_when" as const,
                  line: line.ref,
                  text: line.doneWhenProposal,
                  by: line.doneWhenProposedBy,
                },
              ]),
        ]
      : [];
    const held = working ? [] : heldOn(ctx, line.ref).filter((item) => item.current);
    return {
      start: lineStart(ctx, line.ref),
      stepIn: stepInFor(ctx, line),
      step:
        current === undefined ? null : { position: current.position, of: steps.length, title: current.title },
      forYou: [...proposals, ...questions, ...tasks],
      held: {
        questions: held.filter((item) => item.kind === "question").length,
        tasks: held.filter((item) => item.kind === "task").length,
      },
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
