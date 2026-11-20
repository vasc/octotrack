import { doneWhenSaid, LINE_SAID } from "../lib/said.ts";
import { cantSummary, doneSummary, type TaskOutcome } from "../lib/tasks.ts";
import { homeLines } from "../lib/lines.ts";
import { contracts } from "@octotrack/core/contracts";
import type { HomeView, Issue, Line } from "@octotrack/core/schemas";
import { useMemo, useState } from "react";
import type { z } from "zod";
import type { Move } from "../components/home/LineHandle.tsx";
import { useChoices } from "./useChoices.ts";
import { useOpMutation, useOpQuery } from "./useOp.ts";

function sectionOf(home: HomeView, line: Line): readonly Line[] {
  switch (line.state) {
    case "working":
      return home.working;
    case "up_next":
      return home.upNext;
    case "proposed":
      return home.proposed;
    case "tabled":
      return home.tabled;
    default:
      return [];
  }
}

/** The home view and every choice home makes, as the developer. Choices wait a few seconds with Undo. */
export function useHome() {
  const home = useOpQuery(contracts.homeShow, {});
  const projects = useOpQuery(contracts.projectList, {});
  const repos = useMemo(() => (projects.data ?? []).map((card) => card.project.ref), [projects.data]);
  // A repo by its GitHub name where one is set, else its key, as the boards show it.
  const repoNames = useMemo(
    () =>
      new Map((projects.data ?? []).map((card) => [card.project.ref, card.project.repo ?? card.project.ref])),
    [projects.data],
  );
  // Reordering changes only what home shows, is undone by doing it again, and is never on a number key, so it acts at
  // once; every other choice waits with Undo (D13).
  const order = useOpMutation(contracts.lineOrder);
  // The line whose last move the tracker did not take: said under that line until it moves again.
  const [notMoved, setNotMoved] = useState<string | null>(null);
  const move = (input: z.input<typeof contracts.lineOrder.input>) =>
    order.mutate(input, {
      onSuccess: () => setNotMoved(null),
      onError: () => setNotMoved(input.ref),
    });
  const choices = useChoices();
  const { pending } = choices;
  // Items whose choice waits with Undo: home holds them still and disarms their keys until it takes effect. A choice
  // about a line holds every item that stands for it: the line itself, its Step in, and its done proposals.
  const held = useMemo(
    () =>
      new Set(
        pending.flatMap((choice) =>
          choice.state === "pending" && choice.ref !== null
            ? [
                choice.ref,
                `line:${choice.ref}`,
                `stepin:${choice.ref}`,
                `done:${choice.ref}`,
                `done_when:${choice.ref}`,
              ]
            : [],
        ),
      ),
    [pending],
  );
  const lineOf = (ref: string) => homeLines(home.data).find((line) => line.ref === ref) ?? null;
  const titleOf = (ref: string) => lineOf(ref)?.title ?? ref;
  return {
    home,
    lineOf,
    held,
    notMoved,
    // Try now retries every line stopped the same way: one fix, such as logging in, fixes them all.
    retry: (ref: string) =>
      choices.make(contracts.runnerRetry.name, { line: ref, same: true }, `Trying ${titleOf(ref)} again`),
    anyway: (ref: string) =>
      choices.make(
        contracts.runnerRetry.name,
        { line: ref, anyway: true },
        `Starting one anyway for ${titleOf(ref)}`,
      ),
    setCheckout: (line: string, repo: string, path: string) =>
      choices.make(
        contracts.repoCheckout.name,
        { repo, path, retry: line },
        `Setting ${repoNames.get(repo) ?? repo}'s checkout to ${path}, then trying ${titleOf(line)} again`,
      ),
    repos,
    repoName: (key: string) => repoNames.get(key) ?? key,
    start: (ref: string) => choices.make(contracts.lineStart.name, { ref }, LINE_SAID.start(titleOf(ref))),
    queue: (ref: string) => choices.make(contracts.lineQueue.name, { ref }, LINE_SAID.queue(titleOf(ref))),
    reject: (ref: string) => choices.make(contracts.lineReject.name, { ref }, LINE_SAID.reject(titleOf(ref))),
    drop: (ref: string) => choices.make(contracts.lineDrop.name, { ref }, LINE_SAID.drop(titleOf(ref))),
    table: (ref: string, reason: string | null, lookAgainAt: string | null = null) =>
      choices.make(
        contracts.lineTable.name,
        { ref, ...(reason === null ? {} : { reason }), ...(lookAgainAt === null ? {} : { lookAgainAt }) },
        LINE_SAID.table(titleOf(ref)),
      ),
    fold: (ref: string, into: string) =>
      choices.make(contracts.lineFold.name, { ref, into }, `Folding ${titleOf(ref)} into ${titleOf(into)}`),
    own: (ref: string) => choices.make(contracts.lineOwn.name, { ref }, LINE_SAID.own(titleOf(ref))),
    /** A question put off comes back to its place among the rest. */
    bringBack: (ref: string) =>
      choices.make(contracts.decisionPostpone.name, { ref, undo: true }, `Bringing ${ref} back`),
    lineDone: (ref: string) => choices.make(contracts.lineDone.name, { ref }, LINE_SAID.done(titleOf(ref))),
    notYet: (ref: string, why: string) =>
      choices.make(
        contracts.lineNotYet.name,
        { ref, ...(why === "" ? {} : { why }) },
        `Telling ${titleOf(ref)}'s owner it is not done yet`,
      ),
    doneWhen: (ref: string, accept: boolean) =>
      choices.make(contracts.lineDoneWhenAnswer.name, { ref, accept }, doneWhenSaid(titleOf(ref), accept)),
    acceptRecommended: (refs: string[]) =>
      choices.make(
        contracts.lineAcceptRecommended.name,
        { refs },
        `Placing ${refs.length} proposal${refs.length === 1 ? "" : "s"} where their agents recommend`,
      ),
    taskDone: (task: Issue, outcome: TaskOutcome) =>
      choices.make(
        contracts.taskDone.name,
        { ref: task.ref, ...outcome },
        doneSummary(task, outcome, task.line === null ? null : (lineOf(task.line)?.title ?? null)),
      ),
    taskCant: (task: Issue, why: string) =>
      choices.make(contracts.taskCant.name, { ref: task.ref, why }, cantSummary(task, why)),
    /** Dragged onto another line: it lands before or after it. */
    dropOn: (ref: string, place: { before: string } | { after: string }) => move({ ref, ...place }),
    reorder(ref: string, direction: Move) {
      if (direction === "top") {
        move({ ref, to: "top" });
        return;
      }
      if (direction === "up_next") {
        choices.make(contracts.lineQueue.name, { ref }, LINE_SAID.queue(titleOf(ref)));
        return;
      }
      const data = home.data;
      const line = [...(data?.working ?? []), ...(data?.upNext ?? [])].find(
        (candidate) => candidate.ref === ref,
      );
      if (data === undefined || line === undefined) return;
      const section = sectionOf(data, line);
      const index = section.findIndex((candidate) => candidate.ref === ref);
      const neighbour = section[direction === "up" ? index - 1 : index + 1];
      if (neighbour === undefined) return;
      move(direction === "up" ? { ref, before: neighbour.ref } : { ref, after: neighbour.ref });
    },
  };
}

/** What home can do, as the sections below the page receive it. */
export type HomeActions = ReturnType<typeof useHome>;
