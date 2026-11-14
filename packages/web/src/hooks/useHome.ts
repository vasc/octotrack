import { contracts } from "@octotrack/core/contracts";
import type { HomeView, Line } from "@octotrack/core/schemas";
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

/** The home view and every choice home makes, as the developer. */
export function useHome() {
  const home = useOpQuery(contracts.homeShow, {});
  const add = useOpMutation(contracts.lineAdd);
  const start = useOpMutation(contracts.lineStart);
  const queue = useOpMutation(contracts.lineQueue);
  const reject = useOpMutation(contracts.lineReject);
  const table = useOpMutation(contracts.lineTable);
  const fold = useOpMutation(contracts.lineFold);
  const own = useOpMutation(contracts.lineOwn);
  const order = useOpMutation(contracts.lineOrder);
  const taskDone = useOpMutation(contracts.taskDone);
  const taskCant = useOpMutation(contracts.taskCant);
  const failure =
    add.error ??
    start.error ??
    queue.error ??
    reject.error ??
    table.error ??
    fold.error ??
    own.error ??
    order.error ??
    taskDone.error ??
    taskCant.error;
  return {
    home,
    failure,
    add: (line: { title: string; doneWhen: string }) => add.mutate({ ...line, where: "up_next" }),
    start: (ref: string) => start.mutate({ ref }),
    queue: (ref: string) => queue.mutate({ ref }),
    reject: (ref: string) => reject.mutate({ ref }),
    table: (ref: string, reason: string) => table.mutate({ ref, reason }),
    fold: (ref: string, into: string) => fold.mutate({ ref, into }),
    own: (ref: string) => own.mutate({ ref }),
    taskDone: (ref: string, result: string) => taskDone.mutate({ ref, result }),
    taskCant: (ref: string, why: string) => taskCant.mutate({ ref, why }),
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
