import { type ReactNode, type Ref, useEffect, useId, useRef } from "react";
import { holdKeysForSheet, InSheetProvider } from "../../hooks/useHotkeys.ts";
import { createPortal } from "react-dom";
import { IconButton } from "./Button.tsx";

/**
 * A task of its own, over the whole page: the page and its bar dim behind it, so none of their actions seem to apply.
 * Its title, a few words on what it is for and a cross that closes it at the top, its content, and its actions at the
 * foot. A phone draws it from the bottom; a wide screen as a dialog in the middle. Esc and a tap outside close it, as
 * the cross does.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  closeLabel = "Cancel",
  wide = false,
  children,
  actions,
  ref,
}: {
  title: string;
  /** A few words under the title saying what it is for. */
  subtitle?: string;
  onClose(): void;
  /** The cross's name for a screen reader: Cancel for a sheet that does something, Close for one that only shows. */
  closeLabel?: "Cancel" | "Close";
  /** Holds two columns side by side on a wide screen, as the Keys sheet does. */
  wide?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  const heading = useId();
  const dialog = useRef<HTMLDivElement | null>(null);
  // The keys of the page behind stand down while it is open; its own, inside it, act.
  useEffect(() => holdKeysForSheet(), []);
  // The page behind is outside React's reach from here, and a sheet keeps the focus until it closes: on opening it
  // takes the focus unless a box inside already has it, and the page behind it can be neither focused nor clicked.
  useEffect(() => {
    const element = dialog.current;
    if (element !== null && !element.contains(document.activeElement)) element.focus();
    const page = document.getElementById("root");
    if (page === null || page.inert) return;
    page.inert = true;
    return () => {
      page.inert = false;
    };
  }, []);
  return createPortal(
    <div className="ui-sheet-layer">
      {/* A tap outside closes it, as Esc does for the keyboard. */}
      <div className="ui-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading}
        className="ui-sheet"
        data-wide={wide ? "true" : undefined}
        tabIndex={-1}
        ref={(element) => {
          dialog.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref !== undefined && ref !== null) ref.current = element;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onClose();
        }}
      >
        <header className="ui-sheet-head">
          <div className="ui-sheet-name">
            <h2 id={heading}>{title}</h2>
            {subtitle === undefined ? null : <p className="ui-sheet-subtitle">{subtitle}</p>}
          </div>
          <IconButton icon="cross" label={closeLabel} onClick={onClose} />
        </header>
        <InSheetProvider value>
          <div className="ui-sheet-body">{children}</div>
          {actions === undefined ? null : <footer className="ui-sheet-foot">{actions}</footer>}
        </InSheetProvider>
      </div>
    </div>,
    document.body,
  );
}
