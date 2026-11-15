import { useHeldValue } from "../../hooks/useHeldValue.ts";

/** A box for one line, such as a measurement: Enter cannot add a line, and it keeps what it shows while it has focus. */
export function LineBox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
}) {
  const held = useHeldValue(value);
  return (
    <input
      type="text"
      className="field line-box"
      aria-label={label}
      placeholder={placeholder}
      value={held.shown}
      onFocus={held.onFocus}
      onBlur={held.onBlur}
      onChange={(event) => {
        held.typed(event.currentTarget.value);
        onChange(event.currentTarget.value);
      }}
    />
  );
}
