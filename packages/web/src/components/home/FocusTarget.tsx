import type { ReactNode } from "react";

/**
 * One item in home's focus order, which the browser can focus: the keys move the browser's own focus here, and a
 * click or Tab into it moves home's focus with it. Focused, it is outlined and its numbered choices are drawn.
 */
export function FocusTarget({
  focusRef,
  label,
  focused,
  children,
}: {
  focusRef: string;
  /** What a screen reader says when focus moves here. */
  label: string;
  focused: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      className="focus-wrap"
      aria-label={label}
      data-focus-ref={focusRef}
      data-selected={focused}
      aria-current={focused ? "true" : undefined}
      tabIndex={-1}
    >
      {children}
    </fieldset>
  );
}
