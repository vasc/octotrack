import { useState } from "react";
import type { Suggestion } from "../../hooks/useSuggestions.ts";

export interface FilterBarProps {
  value: string;
  error: string | null;
  suggestions: readonly Suggestion[];
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange(value: string): void;
}

function complete(value: string, term: string): string {
  const words = value.split(/\s+/);
  words[words.length - 1] = term;
  return `${words.join(" ")}${term.endsWith(":") ? "" : " "}`;
}

/** The query box. Pure: suggestions come in from outside and it only keeps track of which one is highlighted. */
export function FilterBar({ value, error, suggestions, placeholder, inputRef, onChange }: FilterBarProps) {
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const open = focused && suggestions.length > 0;
  const highlighted = Math.min(active, suggestions.length - 1);

  const accept = (index: number) => {
    const suggestion = suggestions[index];
    if (suggestion !== undefined) onChange(complete(value, suggestion.term));
    setActive(0);
  };

  return (
    <div className="filter">
      <input
        ref={inputRef}
        className="filter-input"
        aria-label="Filter"
        aria-invalid={error !== null}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder ?? "Filter: kind:decision project:OCT -actor:github since:1d"}
        value={value}
        onChange={(event) => {
          setActive(0);
          onChange(event.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.blur();
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((highlighted + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((highlighted - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Tab" || event.key === "Enter") {
            event.preventDefault();
            accept(highlighted);
          }
        }}
      />
      {error === null ? null : <div className="filter-error">{error}</div>}
      {open ? (
        <ul className="suggestions">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.term}>
              <button
                type="button"
                className="suggestion"
                data-active={index === highlighted}
                onMouseDown={(event) => {
                  // Keep focus in the input, so that typing can carry on.
                  event.preventDefault();
                  accept(index);
                }}
              >
                <code>{suggestion.term}</code>
                <span>{suggestion.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
