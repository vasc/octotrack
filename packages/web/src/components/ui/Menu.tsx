import type { DragEvent, ReactNode, Ref } from "react";
import { useMenu } from "../../hooks/useMenu.ts";
import { Icon, type IconName } from "./Icon.tsx";

/**
 * A button that opens a short menu under it: an icon alone, or words. Opened, the item in force takes the cursor, the
 * arrows move through the items, and Esc, a tap elsewhere or focus leaving closes it.
 */
export function Menu({
  label,
  icon,
  text,
  menuLabel,
  buttonRef,
  lead,
  drag,
  align = "end",
  children,
}: {
  /** The button's name for a screen reader, which says what is chosen now. */
  label: string;
  icon?: IconName;
  /** Words on the button, after its icon. */
  text?: ReactNode;
  /** The menu's own name. */
  menuLabel: string;
  buttonRef?: Ref<HTMLButtonElement>;
  /** The button is a row's lead, such as its number in the order, in the lead's own small grey figures. */
  lead?: string;
  /** The button also drags what it leads. */
  drag?: { onDragStart(event: DragEvent): void; onDragEnd(): void };
  /** Which edge of the button the menu lines up with: the start for a row's lead, the end in the bar. */
  align?: "start" | "end";
  /** Its items, each given a way to close the menu once picked. */
  children(close: () => void): ReactNode;
}) {
  const menu = useMenu();
  return (
    <span className="ui-menu" ref={menu.wrap}>
      <button
        ref={(element) => {
          menu.button.current = element;
          if (typeof buttonRef === "function") buttonRef(element);
          else if (buttonRef !== undefined && buttonRef !== null) buttonRef.current = element;
        }}
        type="button"
        className={lead === undefined ? "ui-button" : "ui-lead"}
        data-variant={lead !== undefined ? undefined : text === undefined ? "icon" : "plain"}
        aria-label={label}
        title={text === undefined && lead === undefined ? menuLabel : undefined}
        draggable={drag === undefined ? undefined : true}
        onDragStart={drag?.onDragStart}
        onDragEnd={drag?.onDragEnd}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.toggle}
        onBlur={menu.leave}
      >
        {icon === undefined ? null : <Icon name={icon} />}
        {lead === undefined ? null : <Icon name="grip" />}
        {lead}
        {text}
        {text === undefined ? null : <Icon name="chevron" />}
      </button>
      {menu.open ? (
        <div
          className="ui-menu-list"
          data-align={align}
          role="menu"
          aria-label={menuLabel}
          onKeyDown={menu.onMenuKey}
          onBlur={menu.leave}
        >
          {children(menu.close)}
        </div>
      ) : null}
    </span>
  );
}

/** A group's name in a menu, such as Theme and Mode: words for the eye; the items name themselves. */
export function MenuGroup({ label }: { label: string }) {
  return (
    <span className="ui-menu-group" aria-hidden="true">
      {label}
    </span>
  );
}

/** One choice in a menu; the one in force is checked and takes the cursor when the menu opens. */
export function MenuItem({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      className="ui-menu-item"
      // biome-ignore lint/a11y/noAutofocus: a menu opened takes the cursor on the choice in force
      autoFocus={checked}
      onClick={onSelect}
    >
      <span className="ui-menu-check" aria-hidden="true">
        {checked ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}

/** One thing a menu does, such as Move to top; unavailable ones stay, disabled, so the menu keeps its shape. */
export function MenuAction({
  onSelect,
  disabled = false,
  autoFocus = false,
  choice,
  children,
}: {
  onSelect(): void;
  disabled?: boolean;
  /** The first available action takes the cursor when the menu opens. */
  autoFocus?: boolean;
  /** The number key that presses it while the menu is open. */
  choice?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="ui-menu-item"
      data-choice={choice === undefined ? undefined : String(choice)}
      disabled={disabled}
      // biome-ignore lint/a11y/noAutofocus: a menu opened takes the cursor on its first action
      autoFocus={autoFocus}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

/** A theme naming itself in its own colours, beside its name in a menu. */
export function Swatch({ palette }: { palette: string }) {
  return <span className="ui-swatch" data-palette={palette} aria-hidden="true" />;
}
