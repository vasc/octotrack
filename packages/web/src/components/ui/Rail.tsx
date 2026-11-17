import type { ReactNode } from "react";

/** A branch's rows on a rail, under the row they fork from, in line with its title: the tree drawn as plainly as a list. */
export function Rail({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset groups a form's fields; a branch's rows are grouped by role
    <div className="ui-rail" role="group" aria-label={label}>
      {children}
    </div>
  );
}
