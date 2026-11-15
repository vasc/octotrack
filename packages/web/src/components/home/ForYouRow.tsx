import type { ForYou } from "@octotrack/core/schemas";
import { useId } from "react";
import { refOf } from "../../lib/focus.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Markdown } from "../ui/Markdown.tsx";

/** Something waiting on the developer, as one row that opens it: what it is, its title, and the case for it. */
export function ForYouRow({ item, onOpen }: { item: ForYou; onOpen(ref: string): void }) {
  const ref = refOf(item);
  // Named by what it does; described by what it is, so a screen reader hears the title too.
  const text = useId();
  return (
    <button
      type="button"
      aria-describedby={text}
      className="item-row"
      data-kind={item.kind}
      data-urgent={item.kind === "question" && item.card.decision.urgentReason !== null}
      aria-label={`Open ${ref}`}
      onClick={() => onOpen(ref)}
    >
      <span className="item-row-text" id={text}>
        {rowText(item)}
      </span>
      <span className="item-row-open" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function rowText(item: ForYou) {
  switch (item.kind) {
    case "question": {
      const { decision } = item.card;
      const recommended = decision.options.find((option) => option.key === decision.recommendation);
      return (
        <>
          <span className="item-kind">
            {decision.urgentReason === null ? "Question" : `Urgent · ${URGENT_REASON[decision.urgentReason]}`}{" "}
            · {decision.ref}
          </span>{" "}
          <b>{decision.title}</b>{" "}
          {recommended === undefined ? null : (
            <span className="item-note">
              Recommended {recommended.label}
              {decision.recommendationWhy === null ? null : (
                <>
                  : <Markdown text={decision.recommendationWhy} inline />
                </>
              )}
            </span>
          )}
        </>
      );
    }
    case "task": {
      const { task, frees } = item;
      return (
        <>
          <span className="item-kind">
            Task · {task.ref}
            {task.place === null ? "" : ` · at ${task.place}`}
          </span>{" "}
          <b>{task.title}</b>{" "}
          {frees !== null ? (
            <span className="item-note">
              Frees {frees.ref}: {frees.title}.
            </span>
          ) : task.outcome === null || task.outcome === "" ? null : (
            <span className="item-note">
              Report: <Markdown text={task.outcome} inline />
            </span>
          )}
        </>
      );
    }
    case "done":
    case "done_when":
      return (
        <>
          <span className="item-kind">
            {item.kind === "done" ? "Proposed done" : "Proposed done when"} · {item.line}
          </span>{" "}
          <span className="item-note">
            <Markdown text={item.text} inline />
          </span>
        </>
      );
  }
}
