import type { Line, LineCrew } from "@octotrack/core/schemas";
import { useId } from "react";
import { LineRow, type LineRowProps } from "./LineRow.tsx";

export interface LineSectionProps extends Omit<LineRowProps, "line" | "crew" | "canMoveUp" | "canMoveDown"> {
  title: string;
  lines: readonly Line[];
  crews?: Readonly<Record<string, LineCrew>>;
  /** Said when the section is empty; a section with no words for that is left out instead. */
  empty?: string;
}

/** One section of the Lines page, in the developer's order. */
export function LineSection({ title, lines, crews = {}, empty, ...actions }: LineSectionProps) {
  const id = useId();
  if (lines.length === 0 && empty === undefined) return null;
  return (
    <section aria-labelledby={id}>
      <div className="section-head">
        <h2 className="section-title" id={id}>
          {title}
        </h2>
      </div>
      {lines.length === 0 ? <p className="muted">{empty}</p> : null}
      <div className="rows">
        {lines.map((line, index) => (
          <LineRow
            key={line.ref}
            line={line}
            {...(crews[line.ref] === undefined ? {} : { crew: crews[line.ref] })}
            canMoveUp={index > 0}
            canMoveDown={index < lines.length - 1}
            {...actions}
          />
        ))}
      </div>
    </section>
  );
}
