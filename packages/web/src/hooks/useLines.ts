import { contracts } from "@octotrack/core/contracts";
import type { HomeView, Line } from "@octotrack/core/schemas";
import type { LineMove } from "../components/lines/LineRow.tsx";
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

/** The home view and every move the Lines page makes, as the developer. */
export function useLines() {
  const home = useOpQuery(contracts.homeShow, {});
  const add = useOpMutation(contracts.lineAdd);
  const start = useOpMutation(contracts.lineStart);
  const queue = useOpMutation(contracts.lineQueue);
  const done = useOpMutation(contracts.lineDone);
  const reject = useOpMutation(contracts.lineReject);
  const table = useOpMutation(contracts.lineTable);
  const order = useOpMutation(contracts.lineOrder);
  const moves = { start, queue, done, reject };
  const failure =
    add.error ?? start.error ?? queue.error ?? done.error ?? reject.error ?? table.error ?? order.error;
  return {
    home,
    failure,
    add(line: { title: string; doneWhen: string }) {
      add.mutate({ ...line, where: "up_next" });
    },
    move(ref: string, move: LineMove) {
      moves[move].mutate({ ref });
    },
    table(ref: string, reason: string) {
      table.mutate({ ref, reason });
    },
    reorder(ref: string, direction: "up" | "down") {
      const data = home.data;
      const line = [
        ...(data?.working ?? []),
        ...(data?.upNext ?? []),
        ...(data?.proposed ?? []),
        ...(data?.tabled ?? []),
      ].find((candidate) => candidate.ref === ref);
      if (data === undefined || line === undefined) return;
      const section = sectionOf(data, line);
      const index = section.findIndex((candidate) => candidate.ref === ref);
      const neighbour = section[direction === "up" ? index - 1 : index + 1];
      if (neighbour === undefined) return;
      order.mutate(direction === "up" ? { ref, before: neighbour.ref } : { ref, after: neighbour.ref });
    },
  };
}
