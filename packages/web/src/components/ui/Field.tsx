import { type ChangeEvent, type KeyboardEvent, type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { useHeldValue } from "../../hooks/useHeldValue.ts";

export interface FieldProps {
  label: string;
  value: string;
  onChange(value: string): void;
  /** The label is for a screen reader only, where the box's place already says what it is for. */
  hideLabel?: boolean;
  placeholder?: string | undefined;
  /** Several lines that grow as they are typed, for anything longer than a word or two. */
  multiline?: boolean;
  /** A date is picked rather than typed. */
  type?: "text" | "date";
  /** Called on Cmd or Ctrl and Enter, so long words are sent without reaching for the mouse. */
  onSubmit?: (() => void) | undefined;
  autoFocus?: boolean;
  /** Counts replacements made on purpose here, which show even while the box holds what was typed. */
  replaced?: number;
  /** A quiet line under the box, such as "Saved as you type, on every device"; read with the box. */
  note?: ReactNode;
  /** What is typed cannot be used: the box is marked, and its note says why. */
  invalid?: boolean;
  /** It cannot be typed in until something else is done. */
  disabled?: boolean;
}

/**
 * A labelled box to type into: one line, or several that grow with what is typed so long words are never written
 * through a slot. While it has focus it keeps what was typed in it, so a draft arriving from another device never
 * changes the text under the cursor.
 */
export function Field({
  label,
  value,
  onChange,
  hideLabel = false,
  placeholder,
  multiline = false,
  type = "text",
  onSubmit,
  autoFocus = false,
  replaced = 0,
  note,
  invalid = false,
  disabled = false,
}: FieldProps) {
  const id = useId();
  const held = useHeldValue(value, replaced);
  const area = useRef<HTMLTextAreaElement>(null);
  // Browsers without field-sizing still grow: the height is only known once the text is laid out, so it is measured
  // whenever what is shown changes, typed here or arrived as a draft.
  useLayoutEffect(() => {
    const element = area.current;
    if (element === null) return;
    element.style.height = "auto";
    if (held.shown === "") return;
    element.style.height = `${element.scrollHeight}px`;
  }, [held.shown]);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    held.typed(event.currentTarget.value);
    onChange(event.currentTarget.value);
  };
  const submitOnShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (onSubmit !== undefined && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  };
  const noteId = `${id}-note`;
  const shared = {
    id,
    disabled,
    "aria-invalid": invalid ? true : undefined,
    "aria-describedby": note === undefined ? undefined : noteId,
    value: held.shown,
    placeholder,
    autoFocus,
    onFocus: held.onFocus,
    onBlur: held.onBlur,
    onChange: change,
    onKeyDown: submitOnShortcut,
  };
  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={id} data-hidden={hideLabel ? "true" : undefined}>
        {label}
      </label>
      {multiline ? <textarea ref={area} rows={1} {...shared} /> : <input type={type} {...shared} />}
      {note === undefined ? null : (
        <span className="ui-field-note" id={noteId} data-invalid={invalid ? "true" : undefined}>
          {note}
        </span>
      )}
    </div>
  );
}

/** Short fields side by side, as many to a row as fit, such as a task's named measurements. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="ui-field-row">{children}</div>;
}
