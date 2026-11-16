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

/**
 * What each field means, in a few words for the dropdown, where a sentence would crowd it; the tracker's own longer
 * descriptions stay for agents and the CLI.
 */
const HINTS: Readonly<Record<string, string>> = {
  kind: "what kind of item",
  ref: "a ref, as D-3",
  project: "a repo, by its key",
  status: "its status",
  priority: "how urgent",
  assignee: "who holds it",
  actor: "who did it",
  event: "what happened, as decision.*",
  changed: "a field that changed",
  from: "what it changed from",
  to: "what it changed to",
  label: "a label",
  type: "a question's type",
  channel: "where it was answered",
  repo: "a repo, by key or GitHub name",
  checks: "a pull request's checks",
  review: "a pull request's review",
  state: "a pull request's state",
  level: "an update's level",
  rule: "what kind of drift",
  target: "what a drift or update is about",
  horizon: "now, next or later",
  milestone: "a milestone, from before lines",
  line: "a line, as L-3",
  blocked: "has open blockers",
  ready: "free to take",
  linked: "linked to a ref",
  since: "on or after a time: 2h, 7d",
  before: "before a time: 1d, a date",
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
      .map((field) => ({ term: `${prefix}${field.name}:`, hint: HINTS[field.name] ?? field.description }));
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
