import type { ForYou } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { focusLabel, refOf } from "../../lib/focus.ts";
import { ForYouItem } from "./ForYouItem.tsx";
import { ForYouRow } from "./ForYouRow.tsx";

/** One thing on a working line that waits on the developer: a row, opened in place while it has focus. */
export function LineForYouItem({
  item,
  title,
  focus,
  armed,
  h,
  onFocus,
  onPostponed,
}: {
  item: ForYou;
  /** The line's title. */
  title: string;
  focus: string | null;
  armed: boolean;
  h: HomeActions;
  onFocus(ref: string): void;
  onPostponed(ref: string): void;
}) {
  const focused = refOf(item) === focus;
  return (
    <ForYouRow item={item} label={focusLabel(item, title)} focused={focused} onOpen={onFocus}>
      {focused ? (
        <ForYouItem
          item={item}
          title={title}
          armed={armed}
          onTaskDone={h.taskDone}
          onTaskCant={h.taskCant}
          onLineDone={h.lineDone}
          onNotYet={h.notYet}
          onDoneWhen={h.doneWhen}
          onPostponed={onPostponed}
        />
      ) : undefined}
    </ForYouRow>
  );
}
