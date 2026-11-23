import { OctoError } from "./errors.ts";
import type { EntityKind } from "./schemas.ts";

export const RESERVED_PROJECT_KEYS: readonly string[] = ["PR", "DR"];

const PROJECT_KEY = /^[A-Z][A-Z0-9]{1,5}$/;
const ISSUE_REF = /^[A-Z][A-Z0-9]{1,5}-\d+$/;

const PREFIXES: readonly (readonly [RegExp, EntityKind])[] = [
  [/^D-\d+$/, "decision"],
  [/^L-\d+$/, "line"],
  [/^PR-\d+$/, "pr"],
  [/^DR-\d+$/, "drift"],
  [/^M-\d+$/, "milestone"],
  [/^I-\d+$/, "idea"],
  [/^U-\d+$/, "update"],
];

export function normalizeRef(ref: string): string {
  return ref.trim().toUpperCase();
}

export function kindOfRef(rawRef: string): EntityKind | null {
  const ref = normalizeRef(rawRef);
  for (const [pattern, kind] of PREFIXES) {
    if (pattern.test(ref)) return kind;
  }
  if (ISSUE_REF.test(ref)) return "issue";
  if (PROJECT_KEY.test(ref)) return "project";
  return null;
}

export function isRefLike(token: string): boolean {
  if (parseRepoPrRef(token) !== null) return true;
  const ref = normalizeRef(token);
  return ref.includes("-") && kindOfRef(ref) !== null;
}

export function assertProjectKey(rawKey: string): string {
  const key = normalizeRef(rawKey);
  if (!PROJECT_KEY.test(key)) {
    throw new OctoError(
      "invalid_input",
      `Invalid project key "${rawKey}"`,
      "Use 2 to 6 letters or digits, starting with a letter, for example OCT.",
    );
  }
  if (RESERVED_PROJECT_KEYS.includes(key)) {
    throw new OctoError("invalid_input", `Project key "${key}" is reserved`);
  }
  return key;
}

/** Parses `owner/repo#12`, the form agents usually have to hand. */
export function parseRepoPrRef(raw: string): { repo: string; number: number } | null {
  const match = /^([^\s/#]+\/[^\s/#]+)#(\d+)$/.exec(raw.trim());
  if (!match) return null;
  const [, repo, number] = match;
  if (repo === undefined || number === undefined) return null;
  return { repo, number: Number(number) };
}

/** Finds every issue-shaped ref in free text, such as a PR title or branch name. */
export function extractIssueRefs(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\b([A-Za-z][A-Za-z0-9]{1,5}-\d+)\b/g)) {
    const candidate = match[1];
    if (candidate === undefined) continue;
    if (kindOfRef(candidate) === "issue") found.add(normalizeRef(candidate));
  }
  return [...found];
}

const ISSUE_IN_TEXT = "[A-Za-z][A-Za-z0-9]{1,5}-\\d+";
/**
 * GitHub's closing keywords, each followed by a ref or a list of them ("Fixes OCT-3, OCT-4 and OCT-5"). The list is
 * read whole, since a pull request named as fixing two issues is wanted while either is.
 */
const CLOSING = new RegExp(
  `\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\b:?\\s+(${ISSUE_IN_TEXT}(?:\\s*(?:,|&|\\band\\b)\\s*${ISSUE_IN_TEXT})*)`,
  "gi",
);

/** The issues text says it closes: each ref after a closing keyword. */
export function closingRefs(text: string): string[] {
  return [...new Set([...text.matchAll(CLOSING)].flatMap((match) => extractIssueRefs(match[1] ?? "")))];
}

/**
 * The issues a pull request implements by what it says (D14): those its branch is named after, and those its title or
 * body names after a closing keyword. A bare mention ("see OCT-3") is background, not a claim to implement it.
 */
export function implementedRefs(pr: {
  title: string;
  headRef?: string | undefined;
  body?: string | undefined;
}): string[] {
  return [
    ...new Set([...extractIssueRefs(pr.headRef ?? ""), ...closingRefs(`${pr.title}\n${pr.body ?? ""}`)]),
  ];
}
