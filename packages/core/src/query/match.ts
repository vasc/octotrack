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
  /** Refs linked one hop from the given ref. Only consulted by `linked:`. */
  linkedRefs(ref: string): ReadonlySet<string>;
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

export function isValidTime(value: string): boolean {
  return DURATION.test(value) || !Number.isNaN(Date.parse(value));
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
    return values.some((value) => env.linkedRefs(value.toUpperCase()).has(doc.ref));
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
      if (matchField(node.field, node.values, doc, env)) return true;
      return (
        node.bare === true &&
        node.values.some((value) => doc.text.toLowerCase().includes(value.toLowerCase()))
      );
  }
}
