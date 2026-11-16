import type { Issue, Line } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { focusLabel } from "../../lib/focus.ts";
import { askedText } from "../../lib/tasks.ts";
import { Focusable } from "../ui/Focusable.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * Tasks for this place that wait on lines up next, each with its choices, saying which line and how long it has
 * waited. Only current ones reach here.
 */
export function AtUpNext({
  tasks,
  lines,
  firstNumber,
  focus,
  task: draw,
}: {
  tasks: readonly Issue[];
  /** Up next, in order, to name each task's line and its number. */
  lines: readonly Line[];
  /** The number of the first up-next line on the list. */
  firstNumber: number;
  focus: string | null;
  /** How a task is drawn, with its choices. */
  task(task: Issue): ReactNode;
}) {
  if (tasks.length === 0) return null;
  return (
    <Section title="Here, from up next" count={tasks.length}>
      <List>
        {tasks.map((task) => {
          const at = lines.findIndex((line) => line.ref === task.line);
          const line = lines[at];
          return (
            <Focusable
              key={task.ref}
              focusRef={task.ref}
              label={focusLabel({ kind: "task", task, frees: null })}
              focused={task.ref === focus}
            >
              <Note>
                {line === undefined ? "" : `${firstNumber + at} · ${line.title} · `}
                {askedText(task)}
              </Note>
              {draw(task)}
            </Focusable>
          );
        })}
      </List>
    </Section>
  );
}
