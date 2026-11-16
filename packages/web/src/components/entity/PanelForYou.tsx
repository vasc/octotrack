import type { ForYou } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import type { HomeActions } from "../../hooks/useHome.ts";
import { focusLabel, refOf } from "../../lib/focus.ts";
import { ForYouItem } from "../home/ForYouItem.tsx";
import { ForYouRow } from "../home/ForYouRow.tsx";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * What the line needs from the developer, in the panel: one row each, opened in its place on a press. While Lines loads, or if it failed, the section stays, saying so.
 */
export function PanelForYou({
  title,
  items,
  h,
  status,
}: {
  title: string;
  items: readonly ForYou[];
  h: HomeActions;
  /** Lines is loading or failed: said under the heading in place of the items. */
  status?: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // Each starts as a row, as drawn; a press opens it in its place.
  const focused = items.some((item) => refOf(item) === open) ? open : null;
  if (status !== undefined) return <Section title="For you">{status}</Section>;
  if (items.length === 0) return null;
  return (
    <Section title="For you" count={items.length}>
      <List>
        {items.map((item) => {
          const ref = refOf(item);
          const isOpen = ref === focused;
          return (
            <ForYouRow
              key={ref}
              item={item}
              label={focusLabel(item, title)}
              focused={isOpen}
              onOpen={setOpen}
              onBringBack={h.bringBack}
            >
              {isOpen ? (
                <ForYouItem
                  item={item}
                  title={title}
                  armed={!h.held.has(ref)}
                  onTaskDone={h.taskDone}
                  onTaskCant={h.taskCant}
                  onLineDone={h.lineDone}
                  onNotYet={h.notYet}
                  onDoneWhen={h.doneWhen}
                />
              ) : undefined}
            </ForYouRow>
          );
        })}
      </List>
    </Section>
  );
}
