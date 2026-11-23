import { Children, type ReactNode, useId } from "react";

/**
 * Rows divided by hairlines; or, as cards, each row its own sheet, for rows that hold much under them, such as the
 * lines being worked on; or bare, rows on the sheet they sit on with no frame of their own, such as the issues in a
 * plan. Named when its rows are choices: the name sits over them as a field's label does, and the rows read as one
 * group.
 */
export function List({
  label,
  cards = false,
  bare = false,
  roomy = false,
  children,
}: {
  label?: string;
  cards?: boolean;
  /** Part of the sheet it sits on: hairlines between its rows, no frame, no ground of its own. */
  bare?: boolean;
  /** Few rows that each matter, such as the lines being worked on: room round each, their titles large. */
  roomy?: boolean;
  children: ReactNode;
}) {
  const heading = useId();
  // An empty list is no box: its owner says why it is empty instead.
  if (Children.toArray(children).length === 0) return null;
  if (label === undefined)
    return (
      <div
        className="ui-list"
        data-cards={cards ? "true" : undefined}
        data-bare={bare ? "true" : undefined}
        data-roomy={roomy ? "true" : undefined}
      >
        {children}
      </div>
    );
  return (
    <div className="ui-group">
      <span className="ui-label" id={heading}>
        {label}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would draw its own box; this names a group of choices */}
      <div className="ui-list" role="group" aria-labelledby={heading}>
        {children}
      </div>
    </div>
  );
}
