import type { HomeView } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import type { HomeActions } from "../../hooks/useHome.ts";
import type { LineSection } from "../../hooks/useLineHandles.tsx";
import { lineFocusRef } from "../../lib/focus.ts";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState } from "../ui/states.tsx";
import { WorkingLine } from "./WorkingLine.tsx";

/** Working on: each line as one row, in the developer's order, saying how it stands and how much waits on them there. */
export function WorkingSection({
  home,
  h,
  focus,
  handle,
  drop,
  actions,
}: {
  home: HomeView;
  h: HomeActions;
  focus: string | null;
  /** A line's handle, which drags it or opens its moves. */
  handle(title: string, ref: string, index: number, count: number, section: LineSection): ReactNode;
  drop(ref: string, section: LineSection): DropTarget;
  /** What sits in the section header: how thin the developer is spread. */
  actions: ReactNode;
}) {
  return (
    <Section title="Working on" count={home.working.length} aside={actions}>
      {home.working.length === 0 ? (
        <EmptyState>Nothing is being worked on</EmptyState>
      ) : (
        <List roomy>
          {home.working.map((line, index) => {
            const details = home.lines[line.ref];
            const crew = home.crews[line.ref];
            return (
              <WorkingLine
                key={line.ref}
                notMoved={h.notMoved === line.ref}
                focused={focus === lineFocusRef(line.ref)}
                drop={drop(line.ref, "working")}
                line={line}
                {...(crew === undefined ? {} : { crew })}
                {...(details === undefined ? {} : { details })}
                handle={handle(line.title, line.ref, index, home.working.length, "working")}
              />
            );
          })}
        </List>
      )}
    </Section>
  );
}
