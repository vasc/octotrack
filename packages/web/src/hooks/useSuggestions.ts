import { QUERY_FIELDS } from "@octotrack/core/query";
import { useMemo } from "react";
import { useBootstrap } from "./useBootstrap.ts";

const STATIC_VALUES: Readonly<Record<string, readonly string[]>> = {
  kind: ["decision", "issue", "pr", "project", "milestone", "idea", "update", "drift"],
  status: ["open", "decided", "todo", "in_progress", "in_review", "blocked", "done", "merged"],
  priority: ["urgent", "high", "medium", "low", "none"],
  type: ["architecture", "product", "technical", "approval"],
  channel: ["dashboard", "cli", "out_of_band"],
  checks: ["failing", "pending", "passing", "none"],
  review: ["requested", "approved", "changes_requested", "none"],
  state: ["open", "draft", "merged", "closed"],
  level: ["blocker", "warning", "progress", "info", "done"],
  horizon: ["now", "next", "later"],
  blocked: ["true", "false"],
  ready: ["true", "false"],
  since: ["1h", "1d", "7d"],
};

export interface Suggestion {
  /** The completed last word of the input. */
  term: string;
  hint: string;
}

const MAX_SUGGESTIONS = 8;

/** Pure, so that it can be tested without rendering: what could the word being typed become? */
export function suggest(
  text: string,
  dynamicValues: Readonly<Record<string, readonly string[]>>,
): Suggestion[] {
  const word = text.split(/\s+/).pop() ?? "";
  const negated = word.startsWith("-");
  const bare = negated ? word.slice(1) : word;
  const prefix = negated ? "-" : "";
  const colon = bare.indexOf(":");
  if (colon === -1) {
    if (bare === "") return [];
    return QUERY_FIELDS.filter((field) => field.name.startsWith(bare.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS)
      .map((field) => ({ term: `${prefix}${field.name}:`, hint: field.description }));
  }
  const field = bare.slice(0, colon);
  const typed = bare.slice(colon + 1);
  const lastValue = typed.split(",").pop() ?? "";
  const earlier = typed.slice(0, typed.length - lastValue.length);
  const values = [...(STATIC_VALUES[field] ?? []), ...(dynamicValues[field] ?? [])];
  return [...new Set(values)]
    .filter((value) => value.toLowerCase().startsWith(lastValue.toLowerCase()) && value !== lastValue)
    .slice(0, MAX_SUGGESTIONS)
    .map((value) => ({ term: `${prefix}${field}:${earlier}${value}`, hint: "" }));
}

export function useSuggestions(text: string): Suggestion[] {
  const { data } = useBootstrap();
  const dynamic = useMemo(
    () => ({
      project: data?.projects.map((card) => card.project.ref) ?? [],
      actor: data?.facets.actors ?? [],
      assignee: data?.facets.actors ?? [],
      label: data?.facets.labels ?? [],
      event: data?.facets.eventTypes ?? [],
    }),
    [data],
  );
  return useMemo(() => suggest(text, dynamic), [text, dynamic]);
}
