import type { Filter } from "../../hooks/useFilter.ts";
import { useSuggestions } from "../../hooks/useSuggestions.ts";
import { FilterBar } from "./FilterBar.tsx";

/** A FilterBar wired to a filter and to suggestions from the tracker's own data. */
export function FilterBox({
  filter,
  placeholder,
  inputRef,
  autoFocus = false,
}: {
  filter: Filter;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Reached with / from another page: the cursor goes straight into the search. */
  autoFocus?: boolean;
}) {
  const suggestions = useSuggestions(filter.text);
  return (
    <FilterBar
      value={filter.text}
      error={filter.error}
      suggestions={suggestions}
      onChange={filter.setText}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(inputRef === undefined ? {} : { inputRef })}
      autoFocus={autoFocus}
    />
  );
}
