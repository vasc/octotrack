import { type ReactNode, type Ref, useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.tsx";

/**
 * A task of its own, over the whole page: the page and its bar dim behind it, so none of their actions seem to apply.
 * Its title and Cancel at the top, its content, and its actions at the foot. A phone draws it from the bottom; a wide
 * screen as a panel in the middle. Esc and a tap outside close it, as Cancel does.
 */
export function Sheet({
  title,
  onClose,
  closeLabel = "Cancel",
  children,
  actions,
  numbered = false,
  ref,
}: {
  title: string;
  onClose(): void;
  /** What the button at the top says: Cancel for a sheet that does something, Close for one that only shows. */
  closeLabel?: "Cancel" | "Close";
  children: ReactNode;
  actions?: ReactNode;
  /** Its choices are numbered for the keys, so their numbers are drawn. */
  numbered?: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  const heading = useId();
  return createPortal(
    <div className="ui-sheet-layer">
      {/* A tap outside closes it, as Esc does for the keyboard. */}
      <div className="ui-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading}
        className="ui-sheet"
        ref={ref}
        data-current={numbered ? "true" : undefined}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onClose();
        }}
      >
        <header className="ui-sheet-head">
          <h2 id={heading}>{title}</h2>
          <Button variant="quiet" onClick={onClose}>
            {closeLabel}
          </Button>
        </header>
        <div className="ui-sheet-body">{children}</div>
        {actions === undefined ? null : <footer className="ui-sheet-foot">{actions}</footer>}
      </div>
    </div>,
    document.body,
  );
}
