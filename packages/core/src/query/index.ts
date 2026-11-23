export { isIsoDate, type MatchEnv, matchQuery, type QueryDoc, resolveTime, valueMatches } from "./match.ts";
export {
  explicitRefsInQuery,
  parseQuery,
  QUERY_FIELDS,
  type QueryField,
  type QueryNode,
  refsInQuery,
  valuesInQuery,
} from "./parser.ts";
export { EVENT_TYPES, type EventTypeName, QUERY_VALUES } from "./values.ts";

/**
 * A line's changes that its summary does not yet tell, newer than the summary: what home counts and the line's panel
 * lists. The developer's own doings (reorders, Tells, their answers) are never news to them, and a reorder by anyone
 * changes only where the line stands.
 */
export function sinceSummaryQuery(line: string): string {
  return `line:${line} -actor:dev -event:line.reordered`;
}
