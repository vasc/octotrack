import type { ReactNode } from "react";

/**
 * One item in home's focus order, which the browser can focus: the keys move the browser's own focus here, and a
 * click or Tab into it moves home's focus with it. Focused, it is outlined and its numbered choices are drawn.
 */
export function FocusTarget({
  focusRef,
  focused,
  children,
}: {
  focusRef: string;
  focused: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="focus-wrap"
      data-focus-ref={focusRef}
      data-selected={focused}
      aria-current={focused ? "true" : undefined}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
