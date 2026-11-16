import type { ForYou, Issue } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { focusLabel, refOf } from "../../lib/focus.ts";
import { Focusable } from "../ui/Focusable.tsx";
import { List } from "../ui/List.tsx";
import { FoldedItems } from "./FoldedItems.tsx";

/**
 * A working line while the developer is at a place: that place's tasks open with their choices, the item with focus
 * opens too, and everything else folds to one sentence.
 */
export function AtPlaceItems({
  forYou,
  at,
  focus,
  task,
  item,
  onFocus,
}: {
  forYou: readonly ForYou[];
  at: string;
  focus: string | null;
  /** How the place's own tasks are drawn, open with their choices. */
  task(task: Issue): ReactNode;
  /** How an item with focus is drawn. */
  item(forYou: ForYou): ReactNode;
  onFocus(ref: string): void;
}) {
  const here = (other: ForYou) => other.kind === "task" && other.task.place === at;
  const folded = forYou.filter((other) => !here(other) && refOf(other) !== focus);
  // With nothing for this place and nothing folded, there is no box to draw.
  if (forYou.length === 0) return null;
  return (
    <List>
      {forYou.map((other) => {
        if (other.kind === "task" && other.task.place === at)
          return (
            <Focusable
              key={refOf(other)}
              focusRef={refOf(other)}
              label={focusLabel(other)}
              focused={refOf(other) === focus}
            >
              {task(other.task)}
            </Focusable>
          );
        return refOf(other) === focus ? item(other) : null;
      })}
      <FoldedItems
        items={folded}
        onOpen={() => {
          const first = folded[0];
          if (first !== undefined) onFocus(refOf(first));
        }}
      />
    </List>
  );
}
