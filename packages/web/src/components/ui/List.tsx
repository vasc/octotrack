import { type ReactNode, useId } from "react";

/**
 * Rows divided by hairlines. Named when its rows are choices: the name sits over them as a field's label does, and
 * the rows read as one group.
 */
export function List({ label, children }: { label?: string; children: ReactNode }) {
  const heading = useId();
  if (label === undefined) return <div className="ui-list">{children}</div>;
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
