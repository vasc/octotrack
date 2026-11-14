import type { ForYou } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { HomeActions } from "../../hooks/useHome.ts";
import { refOf } from "../../lib/focus.ts";
import { FocusTarget } from "./FocusTarget.tsx";
import { FoldedItems } from "./FoldedItems.tsx";
import { TaskItem } from "./TaskItem.tsx";

/**
 * A working line while the developer is at a place: that place's tasks open with their choices, the item with focus
 * opens too, and everything else folds to one sentence.
 */
export function AtPlaceItems({
  forYou,
  at,
  focus,
  h,
  item,
  onFocus,
}: {
  forYou: readonly ForYou[];
  at: string;
  focus: string | null;
  h: HomeActions;
  /** How an item with focus is drawn. */
  item(forYou: ForYou): ReactNode;
  onFocus(ref: string): void;
}) {
  const here = (other: ForYou) => other.kind === "task" && other.task.place === at;
  const folded = forYou.filter((other) => !here(other) && refOf(other) !== focus);
  return (
    <div className="line-items">
      {forYou.map((other) => {
        if (other.kind === "task" && other.task.place === at)
          return (
            <FocusTarget key={refOf(other)} focusRef={refOf(other)} focused={refOf(other) === focus}>
              <TaskItem task={other.task} onDone={h.taskDone} onCant={h.taskCant} />
            </FocusTarget>
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
    </div>
  );
}
