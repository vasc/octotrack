import { type ReactNode, useId } from "react";

/**
 * Rows divided by hairlines; or, as cards, each row its own sheet, for rows that hold much under them, such as the
 * lines being worked on. Named when its rows are choices: the name sits over them as a field's label does, and the
 * rows read as one group.
 */
export function List({
  label,
  cards = false,
  children,
}: {
  label?: string;
  cards?: boolean;
  children: ReactNode;
}) {
  const heading = useId();
  if (label === undefined)
    return (
      <div className="ui-list" data-cards={cards ? "true" : undefined}>
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
