import { contracts } from "@octotrack/core/contracts";
import type { HomeView, Line } from "@octotrack/core/schemas";
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
  const add = useOpMutation(contracts.lineAdd);
  const order = useOpMutation(contracts.lineOrder);
  const choices = useChoices();
  const titleOf = (ref: string) =>
    [
      ...(home.data?.working ?? []),
      ...(home.data?.upNext ?? []),
      ...(home.data?.proposed ?? []),
      ...(home.data?.tabled ?? []),
    ].find((line) => line.ref === ref)?.title ?? ref;
  return {
    home,
    failure: add.error ?? order.error,
    add: (line: { title: string; doneWhen: string }) => add.mutate({ ...line, where: "up_next" }),
    start: (ref: string) => choices.make(contracts.lineStart.name, { ref }, `Started ${titleOf(ref)}`),
    queue: (ref: string) => choices.make(contracts.lineQueue.name, { ref }, `${titleOf(ref)} is up next`),
    reject: (ref: string) => choices.make(contracts.lineReject.name, { ref }, `${titleOf(ref)}: not a line`),
    table: (ref: string, reason: string) =>
      choices.make(contracts.lineTable.name, { ref, reason }, `Tabled ${titleOf(ref)}`),
    fold: (ref: string, into: string) =>
      choices.make(contracts.lineFold.name, { ref, into }, `Folded ${titleOf(ref)} into ${titleOf(into)}`),
    own: (ref: string) => choices.make(contracts.lineOwn.name, { ref }, `You own ${titleOf(ref)}`),
    acceptRecommended: (refs: string[]) =>
      choices.make(
        contracts.lineAcceptRecommended.name,
        { refs },
        `Placed ${refs.length} proposal${refs.length === 1 ? "" : "s"} where their agents recommend`,
      ),
    taskDone: (ref: string, result: string) =>
      choices.make(contracts.taskDone.name, { ref, result }, `${ref} done`),
    taskCant: (ref: string, why: string) =>
      choices.make(contracts.taskCant.name, { ref, why }, `${ref} cannot be done`),
    reorder(ref: string, direction: "up" | "down") {
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
