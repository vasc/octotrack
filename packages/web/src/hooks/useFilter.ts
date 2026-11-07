import { parseQuery } from "@octotrack/core/query";
import { useState } from "react";
import { setParams, useRoute } from "../lib/router.ts";

export interface Filter {
  /** What is in the box, which may be half typed. */
  text: string;
  /** The last text that parsed. Results follow this, so that typing never blanks the screen. */
  query: string;
  error: string | null;
  setText(text: string): void;
  /** Adds a term, as when clicking a chip. */
  addTerm(term: string): void;
}

export function validateQuery(text: string): string | null {
  try {
    parseQuery(text);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The filter lives in the URL, so that it can be bookmarked and survives going back. */
export function useFilter(param = "q"): Filter {
  const { params } = useRoute();
  const text = params.get(param) ?? "";
  const error = validateQuery(text);
  const [lastGood, setLastGood] = useState(error === null ? text : "");
  if (error === null && text !== lastGood) setLastGood(text);

  const setText = (next: string) => setParams({ [param]: next }, true);

  return {
    text,
    query: error === null ? text : lastGood,
    error,
    setText,
    addTerm: (term) => {
      if (` ${text} `.includes(` ${term} `)) return;
      setText(text === "" ? term : `${text} ${term}`);
    },
  };
}
