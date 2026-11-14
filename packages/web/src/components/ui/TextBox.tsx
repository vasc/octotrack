import { type ChangeEvent, type KeyboardEvent, useState } from "react";

export interface TextBoxProps {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  /** Called on Cmd or Ctrl and Enter, so that a long note can be sent without reaching for the mouse. */
  onSubmit?: () => void;
}

/**
 * Grows with what is typed, so a long note is never written through a slot. Markdown is welcome. While it has focus it
 * keeps showing what was typed in it, so a draft arriving from another device never changes the text under the cursor.
 */
export function TextBox({ label, value, onChange, placeholder, onSubmit }: TextBoxProps) {
  const [held, setHeld] = useState<string | null>(null);
  const grow = (event: ChangeEvent<HTMLTextAreaElement>) => {
    // Browsers without field-sizing still grow: the height is only known once the text is laid out.
    const box = event.currentTarget;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
    // Only while it has focus: typing always comes with focus, and an unfocused box shows the draft as it is.
    setHeld((current) => (current === null ? null : box.value));
    onChange(box.value);
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
      value={held ?? value}
      onFocus={() => setHeld(value)}
      onBlur={() => setHeld(null)}
      onChange={grow}
      onKeyDown={submitOnShortcut}
    />
  );
}
