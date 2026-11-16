import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "./Icon.tsx";

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style" | "type" | "children"> & {
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A button of one of three kinds: primary, filled, for the one way forward; plain, a word that acts; quiet, a word that
 * steps back. A choice the keys can press carries its number, drawn beside it only where the keys act.
 */
export function Button({
  variant = "plain",
  type = "button",
  choice,
  icon,
  busy,
  children,
  ...rest
}: {
  variant?: "primary" | "plain" | "quiet";
  type?: "button" | "submit";
  /** The number key that presses it, while its item has focus. */
  choice?: number | string | undefined;
  /** An icon before its words; on a phone, where the bar has no room, the icon alone, still named by its words. */
  icon?: IconName;
  /** On its way: the verb's -ing form in its place ("Stopping…"), and it cannot be pressed again meanwhile. */
  busy?: string | undefined;
  children: ReactNode;
} & Native) {
  return (
    <button
      type={type}
      className="ui-button"
      data-variant={variant}
      data-choice={choice === undefined ? undefined : String(choice)}
      aria-label={icon !== undefined && typeof children === "string" ? children : undefined}
      {...rest}
      {...(busy === undefined ? {} : { disabled: true, "aria-busy": true })}
    >
      {icon === undefined ? null : <Icon name={icon} />}
      {busy ?? (icon === undefined ? children : <span className="ui-button-words">{children}</span>)}
    </button>
  );
}

/** A button that is only an icon: square, quiet, and named for a screen reader and a pointer's tooltip. */
export function IconButton({
  icon,
  label,
  ...rest
}: { icon: IconName; label: string } & Omit<Native, "aria-label" | "title">) {
  return (
    <button
      type="button"
      className="ui-button"
      data-variant="icon"
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
