import { type RefObject, useId, useRef, useState } from "react";
import { focusLeft, useCloseOnOutsideTap } from "../../hooks/useCloseOnOutsideTap.ts";

export interface Completion {
  term: string;
  hint: string;
}

/**
 * A search box with completions under it, as a dropdown over the page: the arrows move through them, Tab or Enter
 * takes one, Esc lets go of the box. Unlike a Field it shows a taken completion at once, since the words it holds
 * change under the cursor only by the developer's own keys.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  error = null,
  completions,
  onTake,
  inputRef,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string | undefined;
  /** Why the words cannot be searched, under the box. */
  error?: string | null;
  completions: readonly Completion[];
  onTake(completion: Completion): void;
  /** The box, for a key elsewhere on the page to put the cursor in it. */
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const wrap = useRef<HTMLElement>(null);
  useCloseOnOutsideTap(wrap, focused, setFocused);
  const open = focused && completions.length > 0;
  const highlighted = Math.min(active, completions.length - 1);
  const take = (index: number) => {
    const completion = completions[index];
    if (completion !== undefined) onTake(completion);
    setActive(0);
  };
  return (
    <search
      className="ui-search"
      ref={wrap}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (focusLeft(wrap, event.relatedTarget)) setFocused(false);
      }}
    >
      <label className="ui-label" data-hidden="true" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="search"
        className="ui-search-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error !== null}
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        role="combobox"
        aria-autocomplete="list"
        // biome-ignore lint/a11y/noAutofocus: reached with /, so the cursor goes straight into the search
        autoFocus={autoFocus}
        onChange={(event) => {
          setActive(0);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setFocused(false);
            event.currentTarget.blur();
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((highlighted + 1) % completions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((highlighted - 1 + completions.length) % completions.length);
          } else if (event.key === "Tab" || event.key === "Enter") {
            event.preventDefault();
            take(highlighted);
          }
        }}
      />
      {error === null ? null : (
        <span className="ui-note" data-error="true" role="alert">
          {error}
        </span>
      )}
      {open ? (
        <span className="ui-search-list" id={`${id}-list`} role="listbox" aria-label={label}>
          {completions.map((completion, index) => (
            <button
              key={completion.term}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              className="ui-search-option"
              tabIndex={-1}
              onClick={() => take(index)}
            >
              <code className="ui-code">{completion.term}</code>
              {completion.hint === "" ? null : <span className="ui-search-hint">{completion.hint}</span>}
            </button>
          ))}
        </span>
      ) : null}
    </search>
  );
}
