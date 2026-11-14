import type { TaskOutcome } from "../lib/tasks.ts";
import { homeLines } from "../lib/lines.ts";
import { contracts } from "@octotrack/core/contracts";
import type { HomeView, Line } from "@octotrack/core/schemas";
import { useMemo } from "react";
import type { Move } from "../components/home/LineHandle.tsx";
import type { NewLine } from "../components/lines/NewLineCard.tsx";
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
  // Reordering and I'm at change only what home shows, are undone by doing them again, and are never on a number
  // key, so they act at once; every other choice waits with Undo (D13).
  const order = useOpMutation(contracts.lineOrder);
  const at = useOpMutation(contracts.at);
  const places = useOpQuery(contracts.placeList, {});
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
    failure: order.error ?? at.error ?? choices.failure,
    places: (places.data ?? []).map((place) => place.name),
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
    at: (place: string | null) => at.mutate(place === null ? {} : { place }),
    repos,
    repoName: (key: string) => repoNames.get(key) ?? key,
    add: (line: NewLine) =>
      choices.make(
        contracts.lineAdd.name,
        line,
        line.where === "working"
          ? `Starting ${line.title}`
          : line.where === "tabled"
            ? `Tabling ${line.title}`
            : `Adding ${line.title} to up next`,
      ),
    start: (ref: string) => choices.make(contracts.lineStart.name, { ref }, `Starting ${titleOf(ref)}`),
    queue: (ref: string) =>
      choices.make(contracts.lineQueue.name, { ref }, `Moving ${titleOf(ref)} to up next`),
    reject: (ref: string) =>
      choices.make(contracts.lineReject.name, { ref }, `Turning down ${titleOf(ref)}: not a line`),
    drop: (ref: string) => choices.make(contracts.lineDrop.name, { ref }, `Dropping ${titleOf(ref)}`),
    table: (ref: string, reason: string, lookAgainAt: string | null = null) =>
      choices.make(
        contracts.lineTable.name,
        { ref, reason, ...(lookAgainAt === null ? {} : { lookAgainAt }) },
        `Tabling ${titleOf(ref)}`,
      ),
    fold: (ref: string, into: string) =>
      choices.make(contracts.lineFold.name, { ref, into }, `Folding ${titleOf(ref)} into ${titleOf(into)}`),
    own: (ref: string) => choices.make(contracts.lineOwn.name, { ref }, `Taking ${titleOf(ref)} as yours`),
    lineDone: (ref: string) =>
      choices.make(contracts.lineDone.name, { ref }, `Closing ${titleOf(ref)} as done`),
    notYet: (ref: string, why: string) =>
      choices.make(
        contracts.lineNotYet.name,
        { ref, ...(why === "" ? {} : { why }) },
        `Telling ${titleOf(ref)}'s owner it is not done yet`,
      ),
    doneWhen: (ref: string, accept: boolean) =>
      choices.make(
        contracts.lineDoneWhenAnswer.name,
        { ref, accept },
        accept ? `Accepting the new done when for ${titleOf(ref)}` : `Keeping ${titleOf(ref)}'s done when`,
      ),
    acceptRecommended: (refs: string[]) =>
      choices.make(
        contracts.lineAcceptRecommended.name,
        { refs },
        `Placing ${refs.length} proposal${refs.length === 1 ? "" : "s"} where their agents recommend`,
      ),
    taskDone: (ref: string, outcome: TaskOutcome) =>
      choices.make(contracts.taskDone.name, { ref, ...outcome }, `Sending ${ref} as done`),
    taskCant: (ref: string, why: string) =>
      choices.make(contracts.taskCant.name, { ref, why }, `Closing ${ref} as not doable`),
    /** Dragged onto another line: it lands before it. */
    dropBefore: (ref: string, before: string) => order.mutate({ ref, before }),
    reorder(ref: string, direction: Move) {
      if (direction === "top") {
        order.mutate({ ref, to: "top" });
        return;
      }
      if (direction === "up_next") {
        choices.make(contracts.lineQueue.name, { ref }, `Moving ${titleOf(ref)} to up next`);
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
      order.mutate(direction === "up" ? { ref, before: neighbour.ref } : { ref, after: neighbour.ref });
    },
  };
}

/** What home can do, as the sections below the page receive it. */
export type HomeActions = ReturnType<typeof useHome>;
