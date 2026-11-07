import type { Filter } from "../../hooks/useFilter.ts";
import { useSuggestions } from "../../hooks/useSuggestions.ts";
import { FilterBar } from "./FilterBar.tsx";

/** A FilterBar wired to a filter and to suggestions from the tracker's own data. */
export function FilterBox({
  filter,
  placeholder,
  inputRef,
}: {
  filter: Filter;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
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
    />
  );
}
