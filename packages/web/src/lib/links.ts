import type { Link } from "@octotrack/core/schemas";

/** What an issue frees (the work it blocks) and what it waits on (the work that blocks it), from its links. */
export function issueLinks(ref: string, links: readonly Link[]): { frees: string[]; waitsOn: string[] } {
  const blocks = links.filter((link) => link.rel === "blocks");
  return {
    frees: blocks.filter((link) => link.fromRef === ref).map((link) => link.toRef),
    waitsOn: blocks.filter((link) => link.toRef === ref).map((link) => link.fromRef),
  };
}
