import { type ChangeEvent, type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { useHeldValue } from "../../hooks/useHeldValue.ts";

export interface TextBoxProps {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  /** Called on Cmd or Ctrl and Enter, so that a long note can be sent without reaching for the mouse. */
  onSubmit?: () => void;
  /** Takes the cursor when it appears, as when a key opened it. */
  autoFocus?: boolean;
}

/**
 * Grows with what is typed, so a long note is never written through a slot. Markdown is welcome. While it has focus it
 * keeps showing what was typed in it, so a draft arriving from another device never changes the text under the cursor.
 */
export function TextBox({ label, value, onChange, placeholder, onSubmit, autoFocus = false }: TextBoxProps) {
  const held = useHeldValue(value);
  const box = useRef<HTMLTextAreaElement>(null);
  // Browsers without field-sizing still grow: the height is only known once the text is laid out, so it is measured
  // whenever what is shown changes, typed here or arrived as a draft.
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    // Emptied, as when its words were sent: back to one line.
    element.style.height = "auto";
    if (held.shown === "") return;
    element.style.height = `${element.scrollHeight}px`;
  }, [held.shown]);
  const grow = (event: ChangeEvent<HTMLTextAreaElement>) => {
    held.typed(event.currentTarget.value);
    onChange(event.currentTarget.value);
  };
  const submitOnShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onSubmit !== undefined && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  };
  return (
    <textarea
      className="field text-box"
      aria-label={label}
      placeholder={placeholder}
      rows={1}
      // biome-ignore lint/a11y/noAutofocus: only when the developer pressed a key to write here
      autoFocus={autoFocus}
      ref={box}
      value={held.shown}
      onFocus={held.onFocus}
      onBlur={held.onBlur}
      onChange={grow}
      onKeyDown={submitOnShortcut}
    />
  );
}
