import type { ReactNode } from "react";

/**
 * One item in a page's focus order, which the browser can focus: the keys move the browser's own focus here, and a
 * click or Tab into it moves the page's focus with it. Focused, it is tinted with an edge inside, and its numbered
 * choices answer to their keys.
 */
export function Focusable({
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
      className="ui-focusable"
      aria-label={label}
      data-focus-ref={focusRef}
      data-current={focused ? "true" : undefined}
      aria-current={focused ? "true" : undefined}
      tabIndex={-1}
    >
      {children}
    </fieldset>
  );
}
