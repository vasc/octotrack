import type { ForYou } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { focusLabel, refOf } from "../../lib/focus.ts";
import { FocusTarget } from "./FocusTarget.tsx";
import { ForYouItem } from "./ForYouItem.tsx";

/** One thing on a working line that waits on the developer, as a focus target. */
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
  const ref = refOf(item);
  return (
    <FocusTarget focusRef={ref} label={focusLabel(item, title)} focused={ref === focus}>
      <ForYouItem
        item={item}
        title={title}
        focused={ref === focus}
        armed={armed}
        onOpen={onFocus}
        onTaskDone={h.taskDone}
        onTaskCant={h.taskCant}
        onLineDone={h.lineDone}
        onNotYet={h.notYet}
        onDoneWhen={h.doneWhen}
        onPostponed={onPostponed}
      />
    </FocusTarget>
  );
}
