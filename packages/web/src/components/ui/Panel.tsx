import { type ReactNode, type Ref, useRef } from "react";
import { useCloseOnPressOutside } from "../../hooks/useCloseOnPressOutside.ts";
import { Only } from "./AppBar.tsx";
import { Button } from "./Button.tsx";
import { Icon } from "./Icon.tsx";

/**
 * An item opened by its ref, over the right of the page so the list keeps its place behind it; the whole screen on a
 * phone. Where it sits, small and grey, then Back to the panel it was opened from and Close, which always shuts it, and
 * on a phone is the way back to the page under it ("Lines", after a back arrow); then its title and its sections. A press
 * on the page beside it closes it too.
 */
export function Panel({
  crumbs,
  title,
  onClose,
  back,
  under = "Lines",
  head,
  children,
}: {
  crumbs?: ReactNode;
  title?: ReactNode;
  onClose(): void;
  /** Opened from another panel: the ref it came from, and the way back to it. */
  back?: { label: string; onBack(): void } | undefined;
  /** The page it opens over, which its way back names on a phone. */
  under?: string;
  /** What belongs with the title, such as what finishes it and its moves; a hairline then sets the sections apart. */
  head?: ReactNode;
  children?: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  useCloseOnPressOutside(wrap, onClose);
  return (
    <div className="ui-panel" ref={wrap}>
      <header className="ui-panel-head">
        <div className="ui-panel-crumbs">{crumbs}</div>
        {back === undefined ? null : (
          <Button onClick={back.onBack}>
            <Icon name="back" />
            Back to {back.label}
          </Button>
        )}
        <Only on="wide">
          <Button onClick={onClose}>Close</Button>
        </Only>
        <Only on="phone">
          <Button onClick={onClose}>
            <Icon name="back" />
            {under}
          </Button>
        </Only>
      </header>
      {title === undefined ? null : <h1 className="ui-panel-title">{title}</h1>}
      {head === undefined ? null : <div className="ui-panel-top">{head}</div>}
      <div className="ui-panel-body" data-under-head={head === undefined ? undefined : "true"}>
        {children}
      </div>
    </div>
  );
}

/** Where an opened ref is drawn: over the right of the page, or the whole screen on a phone. */
export function Side({
  label,
  ref,
  children,
}: {
  label: string;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <aside className="ui-side" aria-label={label} ref={ref} tabIndex={-1}>
      {children}
    </aside>
  );
}
