import type { ForYou } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { refOf } from "../../lib/focus.ts";
import { sinceText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Button } from "../ui/Button.tsx";
import { Focusable } from "../ui/Focusable.tsx";
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
  on,
  onBringBack,
  children,
}: {
  item: ForYou;
  /** The line an urgent question is on, by its number on the page and its title. */
  on?: { number: number; title: string } | undefined;
  /** A question put off comes back to its place among the rest. */
  onBringBack?: ((ref: string) => void) | undefined;
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
  const { kind, tone, title, note } = rowText(item, on);
  const later = item.kind === "question" && item.card.decision.postponedAt !== null;
  return (
    <Row
      {...(later && onBringBack !== undefined
        ? {
            trailing: (
              <Button variant="quiet" aria-label={`Bring back ${ref}`} onClick={() => onBringBack(ref)}>
                Bring back
              </Button>
            ),
          }
        : {})}
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

function rowText(
  item: ForYou,
  on: { number: number; title: string } | undefined,
): {
  kind: string;
  tone: "needs" | "stuck" | "none";
  title: ReactNode;
  note: ReactNode;
} {
  switch (item.kind) {
    case "question": {
      const { decision } = item.card;
      const recommended = decision.options.find((option) => option.key === decision.recommendation);
      return {
        kind:
          decision.postponedAt !== null
            ? `Later · ${decision.ref} · put off ${sinceText(decision.postponedAt)}`
            : decision.urgentReason === null
              ? `Question · ${decision.ref}`
              : `${URGENT_REASON[decision.urgentReason]} · ${on === undefined ? "" : `on ${on.number} · ${on.title} · `}${decision.ref}`,
        tone: decision.postponedAt !== null ? "none" : decision.urgentReason === null ? "needs" : "stuck",
        title: decision.title,
        note:
          // The recommendation alone: its why is read once the question is opened.
          recommended === undefined ? null : `Recommended: ${recommended.label}`,
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
