import { OctoError } from "../errors.ts";
import { isRefLike, normalizeRef, parseRepoPrRef } from "../refs.ts";
import { isValidTime, valueMatches } from "./match.ts";
import { QUERY_VALUES } from "./values.ts";

export type QueryNode =
  | { type: "all" }
  | { type: "and"; children: QueryNode[] }
  | { type: "or"; children: QueryNode[] }
  | { type: "not"; child: QueryNode }
  /** `bare` marks a word that merely looks like a ref, such as UTF-8. It also matches as free text. */
  | { type: "field"; field: string; values: string[]; bare?: boolean }
  | { type: "text"; value: string };

export interface QueryField {
  name: string;
  description: string;
}

export const QUERY_FIELDS: readonly QueryField[] = [
  { name: "kind", description: "project, issue, decision, pr, milestone, idea, update, drift" },
  { name: "ref", description: "A specific item, for example ref:D-3,OCT-12. A bare D-3 means the same." },
  { name: "project", description: "Project key" },
  { name: "status", description: "Status of the item (open, decided, in_progress, ...)" },
  { name: "priority", description: "urgent, high, medium, low, none" },
  { name: "assignee", description: "Agent an item is assigned to; none for unassigned" },
  { name: "actor", description: "Who caused an event" },
  { name: "event", description: "Event type, globs allowed: decision.*, issue.status_changed" },
  { name: "changed", description: "A field that changed in this event, for example changed:checks" },
  { name: "from", description: "Previous value of a changed field" },
  { name: "to", description: "New value of a changed field" },
  { name: "label", description: "Issue or idea label" },
  { name: "type", description: "Decision type: technical, architecture, product, approval" },
  { name: "channel", description: "How a decision was made: dashboard, cli, out_of_band" },
  { name: "repo", description: "PR repository, owner/name" },
  { name: "checks", description: "PR checks: none, pending, passing, failing" },
  { name: "review", description: "PR review: none, requested, approved, changes_requested" },
  { name: "state", description: "PR state: open, draft, merged, closed" },
  { name: "level", description: "Status update level: info, progress, warning, blocker, done" },
  { name: "rule", description: "Drift rule, for example issue-closed-pr-open" },
  { name: "target", description: "Item a drift or update is about" },
  { name: "horizon", description: "now, next, later, none" },
  { name: "milestone", description: "Milestone ref" },
  { name: "blocked", description: "true when an issue has open blockers" },
  { name: "ready", description: "true for an unblocked, unassigned issue in todo" },
  { name: "linked", description: "Items linked to this ref, for example linked:OCT-12" },
  { name: "since", description: "On or after a time: since:2h, since:7d, since:2026-11-01" },
  { name: "before", description: "Before a time: before:1d, before:2026-11-01" },
];

const FIELD_NAMES: ReadonlySet<string> = new Set(QUERY_FIELDS.map((field) => field.name));

type Token =
  | { type: "open"; pos: number }
  | { type: "close"; pos: number }
  | { type: "or"; pos: number }
  | { type: "and"; pos: number }
  | { type: "not"; pos: number }
  | { type: "term"; pos: number; field: string | null; values: string[]; quoted: boolean };

function queryError(input: string, pos: number, message: string): OctoError {
  return new OctoError(
    "invalid_query",
    `${message} at position ${pos} in: ${input}`,
    `Fields: ${QUERY_FIELDS.map((field) => field.name).join(", ")}. Example: kind:decision status:open -actor:bot`,
  );
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n";
}

function readQuoted(input: string, start: number): { value: string; next: number } {
  let value = "";
  let index = start + 1;
  while (index < input.length) {
    const char = input.charAt(index);
    if (char === "\\" && input.charAt(index + 1) === '"') {
      value += '"';
      index += 2;
      continue;
    }
    if (char === '"') return { value, next: index + 1 };
    value += char;
    index += 1;
  }
  throw queryError(input, start, "Unterminated quote");
}

function readBare(input: string, start: number): { value: string; next: number } {
  let index = start;
  while (index < input.length) {
    const char = input.charAt(index);
    if (isSpace(char) || char === "(" || char === ")") break;
    index += 1;
  }
  return { value: input.slice(start, index), next: index };
}

function readValues(input: string, start: number): { values: string[]; next: number } {
  const values: string[] = [];
  let index = start;
  while (true) {
    const piece = input.charAt(index) === '"' ? readQuoted(input, index) : readBareValue(input, index);
    values.push(piece.value);
    index = piece.next;
    if (input.charAt(index) !== ",") return { values, next: index };
    index += 1;
  }
}

function readBareValue(input: string, start: number): { value: string; next: number } {
  let index = start;
  while (index < input.length) {
    const char = input.charAt(index);
    if (isSpace(char) || char === "(" || char === ")" || char === ",") break;
    index += 1;
  }
  return { value: input.slice(start, index), next: index };
}

function assertKnownValue(input: string, pos: number, field: string, value: string): void {
  if ((field === "since" || field === "before") && !isValidTime(value)) {
    throw queryError(input, pos, `"${value}" is not a time for ${field}. Use 2h, 7d or a date`);
  }
  const known = QUERY_VALUES[field];
  if (known === undefined || value.toLowerCase() === "none") return;
  if (!known.some((candidate) => valueMatches(value, candidate))) {
    throw queryError(
      input,
      pos,
      `"${value}" is not a value of ${field}. Expected one of: ${known.join(", ")}`,
    );
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input.charAt(index);
    if (isSpace(char)) {
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "open", pos: index });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "close", pos: index });
      index += 1;
      continue;
    }
    if (char === "-" && index + 1 < input.length && !isSpace(input.charAt(index + 1))) {
      tokens.push({ type: "not", pos: index });
      index += 1;
      continue;
    }
    if (char === '"') {
      const { value, next } = readQuoted(input, index);
      tokens.push({ type: "term", pos: index, field: null, values: [value], quoted: true });
      index = next;
      continue;
    }
    const fieldMatch = /^([a-zA-Z_]+):/.exec(input.slice(index));
    const fieldName = fieldMatch?.[1];
    if (fieldName !== undefined) {
      const field = fieldName.toLowerCase();
      if (input.slice(index + fieldName.length, index + fieldName.length + 3) === "://") {
        const { value, next } = readBare(input, index);
        tokens.push({ type: "term", pos: index, field: null, values: [value], quoted: true });
        index = next;
        continue;
      }
      if (!FIELD_NAMES.has(field)) {
        throw queryError(input, index, `Unknown field "${field}". Put text with a colon in quotes`);
      }
      const valueStart = index + fieldName.length + 1;
      const startChar = input.charAt(valueStart);
      if (startChar === "" || isSpace(startChar) || startChar === ")") {
        throw queryError(input, index, `Field "${field}" has no value`);
      }
      const { values, next } = readValues(input, valueStart);
      if (values.some((value) => value === ""))
        throw queryError(input, index, `Field "${field}" has an empty value`);
      for (const value of values) assertKnownValue(input, index, field, value);
      tokens.push({ type: "term", pos: index, field, values, quoted: false });
      index = next;
      continue;
    }
    const { value, next } = readBare(input, index);
    if (value === "OR") tokens.push({ type: "or", pos: index });
    else if (value === "AND") tokens.push({ type: "and", pos: index });
    else if (value === "NOT") tokens.push({ type: "not", pos: index });
    else tokens.push({ type: "term", pos: index, field: null, values: [value], quoted: false });
    index = next;
  }
  return tokens;
}

/** Recursive descent: or -> and -> unary -> primary. Adjacent terms are an implicit AND. */
class Parser {
  private index = 0;

  constructor(
    private readonly input: string,
    private readonly tokens: Token[],
  ) {}

  parse(): QueryNode {
    if (this.tokens.length === 0) return { type: "all" };
    const node = this.parseOr();
    const leftover = this.tokens[this.index];
    if (leftover !== undefined) throw queryError(this.input, leftover.pos, "Unexpected token");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private parseOr(): QueryNode {
    const children = [this.parseAnd()];
    while (this.peek()?.type === "or") {
      this.index += 1;
      children.push(this.parseAnd());
    }
    const [only] = children;
    return children.length === 1 && only !== undefined ? only : { type: "or", children };
  }

  private parseAnd(): QueryNode {
    const children = [this.parseUnary()];
    while (true) {
      const next = this.peek();
      if (next === undefined || next.type === "or" || next.type === "close") break;
      if (next.type === "and") this.index += 1;
      children.push(this.parseUnary());
    }
    const [only] = children;
    return children.length === 1 && only !== undefined ? only : { type: "and", children };
  }

  private parseUnary(): QueryNode {
    const token = this.peek();
    if (token?.type === "not") {
      this.index += 1;
      return { type: "not", child: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): QueryNode {
    const token = this.peek();
    if (token === undefined) throw queryError(this.input, this.input.length, "Unexpected end of query");
    if (token.type === "open") {
      this.index += 1;
      const inner = this.parseOr();
      const close = this.peek();
      if (close?.type !== "close") throw queryError(this.input, token.pos, "Unclosed parenthesis");
      this.index += 1;
      return inner;
    }
    if (token.type === "term") {
      this.index += 1;
      if (token.field !== null) return { type: "field", field: token.field, values: token.values };
      const [value = ""] = token.values;
      if (!token.quoted && isRefLike(value))
        return { type: "field", field: "ref", values: [value], bare: true };
      return { type: "text", value };
    }
    throw queryError(this.input, token.pos, "Unexpected token");
  }
}

export function parseQuery(input: string): QueryNode {
  return new Parser(input, tokenize(input)).parse();
}

/** Normalizes a ref as written in a query. `owner/repo#12` keeps its case, since GitHub names are case sensitive. */
function queryRef(value: string): string {
  return parseRepoPrRef(value) === null ? normalizeRef(value) : value;
}

/** Every value a query asks for positively in one field. A negated term says what it is not, so it does not count. */
export function valuesInQuery(node: QueryNode, field: string): string[] {
  switch (node.type) {
    case "all":
    case "text":
    case "not":
      return [];
    case "and":
    case "or":
      return node.children.flatMap((child) => valuesInQuery(child, field));
    case "field":
      return node.field === field ? node.values : [];
  }
}

/** Every ref a query names, explicitly or as a bare word. Used to show who is waiting on which item. */
export function refsInQuery(node: QueryNode): string[] {
  return valuesInQuery(node, "ref").map(queryRef);
}

/** Only the refs named with `ref:`. These must exist, whereas a bare word such as UTF-8 may just be text. */
export function explicitRefsInQuery(node: QueryNode): string[] {
  switch (node.type) {
    case "all":
    case "text":
    case "not":
      return [];
    case "and":
    case "or":
      return node.children.flatMap(explicitRefsInQuery);
    case "field":
      return node.field === "ref" && node.bare !== true ? node.values.map(queryRef) : [];
  }
}
