import type { ForYou } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { refOf } from "../../lib/focus.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Focusable } from "../ui/Focusable.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Row } from "../ui/Row.tsx";

/**
 * Something waiting on the developer: one row that opens it, saying what it is, its title and the case for it; or,
 * with focus, the item itself in its place, which the keys act on.
 */
export function ForYouRow({
  item,
  label,
  focused,
  onOpen,
  children,
}: {
  item: ForYou;
  /** What a screen reader says when focus reaches it. */
  label: string;
  focused: boolean;
  onOpen(ref: string): void;
  /** The item opened, drawn while it has focus. */
  children?: ReactNode;
}) {
  const ref = refOf(item);
  if (focused && children !== undefined)
    return (
      <Focusable focusRef={ref} label={label} focused>
        {children}
      </Focusable>
    );
  const { kind, tone, title, note } = rowText(item);
  return (
    <Row
      focusRef={ref}
      label={label}
      openLabel={`Open ${ref}`}
      kind={kind}
      tone={tone}
      title={title}
      {...(note === null ? {} : { note })}
      onOpen={() => onOpen(ref)}
    />
  );
}

function rowText(item: ForYou): {
  kind: string;
  tone: "needs" | "stuck";
  title: ReactNode;
  note: ReactNode;
} {
  switch (item.kind) {
    case "question": {
      const { decision } = item.card;
      const recommended = decision.options.find((option) => option.key === decision.recommendation);
      return {
        kind:
          decision.urgentReason === null
            ? `Question · ${decision.ref}`
            : `Urgent · ${URGENT_REASON[decision.urgentReason]} · ${decision.ref}`,
        tone: decision.urgentReason === null ? "needs" : "stuck",
        title: decision.title,
        note:
          recommended === undefined ? null : (
            <>
              Recommended: {recommended.label}
              {decision.recommendationWhy === null ? null : (
                <>
                  {" "}
                  · <Markdown text={decision.recommendationWhy} inline />
                </>
              )}
            </>
          ),
      };
    }
    case "task": {
      const { task, frees } = item;
      return {
        kind: `Task · ${task.ref}${task.place === null ? "" : ` · at ${task.place}`}`,
        tone: "needs",
        title: task.title,
        note:
          frees !== null ? (
            `Frees ${frees.ref}: ${frees.title}`
          ) : task.outcome === null || task.outcome === "" ? null : (
            <Markdown text={task.outcome} inline />
          ),
      };
    }
    case "done":
    case "done_when":
      return {
        kind: `${item.kind === "done" ? "Proposed done" : "Proposed done when"} · ${item.line}`,
        tone: "needs",
        title: <Markdown text={item.text} inline />,
        note: null,
      };
  }
}
