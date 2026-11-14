import type { ChangeEvent, KeyboardEvent } from "react";

export interface TextBoxProps {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  /** Called on Cmd or Ctrl and Enter, so that a long note can be sent without reaching for the mouse. */
  onSubmit?: () => void;
}

/** Grows with what is typed, so a long note is never written through a slot. Markdown is welcome. */
export function TextBox({ label, value, onChange, placeholder, onSubmit }: TextBoxProps) {
  const grow = (event: ChangeEvent<HTMLTextAreaElement>) => {
    // Browsers without field-sizing still grow: the height is only known once the text is laid out.
    const box = event.currentTarget;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
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
      value={value}
      onChange={grow}
      onKeyDown={submitOnShortcut}
    />
  );
}
