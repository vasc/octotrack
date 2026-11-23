import { contracts } from "../contracts.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { loadGraph } from "../store/graph.ts";
import { IdeaRow } from "../store/rows.ts";
import { bind } from "./bind.ts";

export const ideaOps = [
  bind(contracts.ideaList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, IdeaRow, "SELECT * FROM ideas ORDER BY updatedAt DESC").map((value) => ({
      kind: "idea" as const,
      value,
    }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),
];
