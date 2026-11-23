import { OctoError } from "../errors.ts";
import type { QueryNode } from "./parser.ts";

/** A query target: an entity's current state, or an event in the log. */
export interface QueryDoc {
  ref: string;
  fields: Readonly<Record<string, readonly string[]>>;
  text: string;
  time: string;
}

export interface MatchEnv {
  now: string;
  /** Refs linked one hop from the given ref, in any spelling. Only consulted by `linked:`. */
  linkedRefs(ref: string): ReadonlySet<string>;
  /** Whether something really goes by this name. Decides what a bare word such as D-3 or UTF-8 means. */
  refExists(ref: string): boolean;
}

const globCache = new Map<string, RegExp>();

function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob);
  if (cached) return cached;
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const compiled = new RegExp(`^${source}$`, "i");
  if (globCache.size > 500) globCache.clear();
  globCache.set(glob, compiled);
  return compiled;
}

export function valueMatches(pattern: string, actual: string): boolean {
  if (pattern.includes("*") || pattern.includes("?")) return globToRegExp(pattern).test(actual);
  return pattern.toLowerCase() === actual.toLowerCase();
}

const DURATION = /^(\d+)(m|h|d|w)$/;
const UNIT_MS: Readonly<Record<string, number>> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** A real calendar date, or date and time. Date.parse alone accepts "5", and rolls 2026-02-31 over to March. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (match === null || Number.isNaN(Date.parse(value))) return false;
  const [, year, month, day] = match;
  const asUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return asUtc.getUTCMonth() === Number(month) - 1 && asUtc.getUTCDate() === Number(day);
}

export function isValidTime(value: string): boolean {
  return DURATION.test(value) || isIsoDate(value);
}

/** As a whole word: UTF-8 must not match UTF-80. */
function containsWord(text: string, word: string): boolean {
  const haystack = text.toLowerCase();
  const needle = word.toLowerCase();
  const isWordChar = (char: string) => /[a-z0-9-]/.test(char);
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    const before = haystack.charAt(from - 1);
    const after = haystack.charAt(from + needle.length);
    if ((before === "" || !isWordChar(before)) && (after === "" || !isWordChar(after))) return true;
    from = haystack.indexOf(needle, from + 1);
  }
  return false;
}

/**
 * A bare D-3 means that item, and nothing else that happens to mention it, or a watch would fire on another item's
 * title. Only a word that names nothing is text, such as UTF-8.
 */
function matchBare(values: readonly string[], doc: QueryDoc, env: MatchEnv): boolean {
  return values.some((value) =>
    env.refExists(value) ? matchField("ref", [value], doc, env) : containsWord(doc.text, value),
  );
}

/** Accepts a relative duration (`2h`) or an absolute date. Returns epoch milliseconds. */
export function resolveTime(value: string, now: string): number {
  const match = DURATION.exec(value);
  const amount = match?.[1];
  const unit = match?.[2];
  if (amount !== undefined && unit !== undefined) {
    return Date.parse(now) - Number(amount) * (UNIT_MS[unit] ?? 0);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new OctoError(
      "invalid_query",
      `Invalid time "${value}"`,
      "Use a duration such as 2h or 7d, or a date.",
    );
  }
  return parsed;
}

function matchField(field: string, values: readonly string[], doc: QueryDoc, env: MatchEnv): boolean {
  if (field === "since") return values.some((value) => Date.parse(doc.time) >= resolveTime(value, env.now));
  if (field === "before") return values.some((value) => Date.parse(doc.time) < resolveTime(value, env.now));
  if (field === "linked") {
    return values.some((value) => env.linkedRefs(value).has(doc.ref));
  }
  const actual = doc.fields[field];
  if (actual === undefined || actual.length === 0)
    return values.some((value) => value.toLowerCase() === "none");
  return values.some((pattern) => actual.some((value) => valueMatches(pattern, value)));
}

export function matchQuery(node: QueryNode, doc: QueryDoc, env: MatchEnv): boolean {
  switch (node.type) {
    case "all":
      return true;
    case "and":
      return node.children.every((child) => matchQuery(child, doc, env));
    case "or":
      return node.children.some((child) => matchQuery(child, doc, env));
    case "not":
      return !matchQuery(node.child, doc, env);
    case "text":
      return doc.text.toLowerCase().includes(node.value.toLowerCase());
    case "field":
      if (node.bare === true) return matchBare(node.values, doc, env);
      return matchField(node.field, node.values, doc, env);
  }
}
