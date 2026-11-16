import type { RefObject } from "react";
import type { Suggestion } from "../../hooks/useSuggestions.ts";
import { SearchField } from "../ui/SearchField.tsx";

export interface FilterBarProps {
  value: string;
  error: string | null;
  suggestions: readonly Suggestion[];
  placeholder?: string;
  /** Given the box, for a key elsewhere on the page to put the cursor in it. */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Takes the cursor when it appears, as when / brought the developer here. */
  autoFocus?: boolean;
  onChange(value: string): void;
}

/** The last word of a query, completed: a field name waits for its value; a value ends the word. */
function complete(value: string, term: string): string {
  const words = value.split(/\s+/);
  words[words.length - 1] = term;
  return `${words.join(" ")}${term.endsWith(":") ? "" : " "}`;
}

/** The query box, with the tracker's own fields and values offered as the last word is typed. */
export function FilterBar({
  value,
  error,
  suggestions,
  placeholder,
  inputRef,
  autoFocus = false,
  onChange,
}: FilterBarProps) {
  return (
    <SearchField
      label="Search the log"
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? "Search: line:L-56 since:2d actor:ttube"}
      error={error}
      completions={suggestions}
      onTake={(completion) => onChange(complete(value, completion.term))}
      {...(inputRef === undefined ? {} : { inputRef })}
      autoFocus={autoFocus}
    />
  );
}
