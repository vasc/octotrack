import type { PullRequest } from "@octotrack/core/schemas";

/** Pushed to after it was said to be ready to merge: what was judged ready is not what is there now. */
export function pushedSinceReady(pr: PullRequest): boolean {
  return pr.readySha !== null && pr.readySha !== "" && pr.headSha !== "" && pr.headSha !== pr.readySha;
}

/** What a pull request on a line is, as its row names it first. */
export function prKind(pr: PullRequest): "Ready to merge" | "Draft" | "Pull request" {
  if (pr.readyAt !== null) return "Ready to merge";
  return pr.state === "draft" ? "Draft" : "Pull request";
}
