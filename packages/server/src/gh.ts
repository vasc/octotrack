import type { PrChecks, PrInput, PrMergeable, PrReview, PrState } from "@octotrack/core";
import { z } from "zod";

const GH_FIELDS = [
  "number",
  "title",
  "body",
  "url",
  "state",
  "isDraft",
  "headRefName",
  "baseRefName",
  "headRefOid",
  "author",
  "additions",
  "deletions",
  "reviewDecision",
  "mergeable",
  "mergedAt",
  "closedAt",
  "updatedAt",
  "statusCheckRollup",
].join(",");

const RECENT_MS = 7 * 86_400_000;
const LIST_LIMITS: readonly { state: string; limit: number }[] = [
  { state: "open", limit: 50 },
  { state: "merged", limit: 20 },
  { state: "closed", limit: 10 },
];
const MAX_INDIVIDUAL_LOOKUPS = 20;
/** A busy repo answers in about six seconds. Past this it is stuck, and a stuck sync must not block all later ones. */
const DEFAULT_GH_TIMEOUT_MS = 30_000;

function ghTimeoutMs(): number {
  const parsed = Number(process.env.OCTO_GH_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GH_TIMEOUT_MS;
}

const CheckItem = z.object({
  status: z.string().optional(),
  conclusion: z.string().nullable().optional(),
  state: z.string().optional(),
});

export const GhPr = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string(),
  state: z.string(),
  isDraft: z.boolean(),
  headRefName: z.string(),
  baseRefName: z.string(),
  headRefOid: z.string(),
  author: z.object({ login: z.string() }).nullable(),
  additions: z.number().int(),
  deletions: z.number().int(),
  reviewDecision: z.string().nullable(),
  mergeable: z.string().nullable(),
  mergedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  updatedAt: z.string(),
  statusCheckRollup: z.array(CheckItem).nullable(),
});
export type GhPr = z.infer<typeof GhPr>;

const FAILED: ReadonlySet<string> = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
  "ERROR",
]);

export function mapChecks(items: readonly z.infer<typeof CheckItem>[] | null): PrChecks {
  if (items === null || items.length === 0) return "none";
  const outcome = items.map((item) => item.conclusion ?? item.state ?? "");
  if (outcome.some((value) => FAILED.has(value))) return "failing";
  const stillRunning = items.some(
    (item) =>
      item.state === "PENDING" ||
      item.state === "EXPECTED" ||
      (item.status !== undefined && item.status !== "COMPLETED"),
  );
  return stillRunning ? "pending" : "passing";
}

function mapState(pr: GhPr): PrState {
  if (pr.state === "MERGED") return "merged";
  if (pr.state === "CLOSED") return "closed";
  return pr.isDraft ? "draft" : "open";
}

function mapReview(decision: string | null): PrReview {
  if (decision === "APPROVED") return "approved";
  if (decision === "CHANGES_REQUESTED") return "changes_requested";
  if (decision === "REVIEW_REQUIRED") return "requested";
  return "none";
}

function mapMergeable(mergeable: string | null): PrMergeable {
  if (mergeable === "MERGEABLE") return "clean";
  if (mergeable === "CONFLICTING") return "conflicting";
  return "unknown";
}

export function mapGhPr(repo: string, pr: GhPr): PrInput {
  return {
    repo,
    number: pr.number,
    title: pr.title,
    body: pr.body ?? "",
    url: pr.url,
    state: mapState(pr),
    checks: mapChecks(pr.statusCheckRollup),
    review: mapReview(pr.reviewDecision),
    mergeable: mapMergeable(pr.mergeable),
    headRef: pr.headRefName,
    baseRef: pr.baseRefName,
    headSha: pr.headRefOid,
    author: pr.author?.login ?? "unknown",
    additions: pr.additions,
    deletions: pr.deletions,
    mergedAt: pr.mergedAt,
    closedAt: pr.closedAt,
  };
}

/**
 * Open PRs plus anything that finished recently. Old closed PRs are left out: a first sync of a busy repo would
 * otherwise bury the feed in history nobody needs to act on.
 */
export function selectRelevant(
  prs: readonly GhPr[],
  now: number,
  trackedOpen: readonly number[] = [],
): GhPr[] {
  return prs.filter(
    (pr) =>
      pr.state === "OPEN" || now - Date.parse(pr.updatedAt) < RECENT_MS || trackedOpen.includes(pr.number),
  );
}

async function runGh(args: readonly string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const limit = ghTimeoutMs();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, limit);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (timedOut) throw new Error(`gh did not answer within ${limit}ms`);
    if (exitCode !== 0) throw new Error(stderr.trim() || `gh exited with ${exitCode}`);
    return stdout;
  } finally {
    clearTimeout(timer);
  }
}

async function listByState(repo: string, state: string, limit: number): Promise<GhPr[]> {
  const stdout = await runGh([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    state,
    "--limit",
    String(limit),
    "--json",
    GH_FIELDS,
  ]);
  const parsed: unknown = JSON.parse(stdout);
  return z.array(GhPr).parse(parsed);
}

async function viewOne(repo: string, number: number): Promise<GhPr> {
  const stdout = await runGh(["pr", "view", String(number), "--repo", repo, "--json", GH_FIELDS]);
  const parsed: unknown = JSON.parse(stdout);
  return GhPr.parse(parsed);
}

export interface RepoPrs {
  prs: PrInput[];
  /** Problems with single PRs. The rest of the repo still synced. */
  warnings: string[];
}

/**
 * Separate small requests rather than one large one: on a busy repo, asking GitHub for 100 PRs with their check
 * rollups times out with a 504. `trackedOpen` covers what the lists can miss: a PR we still think is open that has
 * fallen out of the window, for instance merged while this machine was asleep, would otherwise stay open forever. It
 * is applied however old it is, and one that cannot be found must not stop the rest of the repo from updating.
 */
export async function fetchRepoPrs(repo: string, trackedOpen: readonly number[] = []): Promise<RepoPrs> {
  let lists: GhPr[];
  try {
    lists = (
      await Promise.all(LIST_LIMITS.map(({ state, limit }) => listByState(repo, state, limit)))
    ).flat();
  } catch (error) {
    throw new Error(`gh failed for ${repo}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const seen = new Set(lists.map((pr) => pr.number));
  const missing = trackedOpen.filter((number) => !seen.has(number)).slice(0, MAX_INDIVIDUAL_LOOKUPS);
  const lookups = await Promise.allSettled(missing.map((number) => viewOne(repo, number)));
  const individually = lookups.flatMap((lookup) => (lookup.status === "fulfilled" ? [lookup.value] : []));
  const warnings = lookups.flatMap((lookup, index) =>
    lookup.status === "rejected"
      ? [
          `${repo}#${missing[index]}: ${lookup.reason instanceof Error ? lookup.reason.message : String(lookup.reason)}`,
        ]
      : [],
  );
  const relevant = selectRelevant(lists, Date.now(), trackedOpen);
  return { prs: [...relevant, ...individually].map((pr) => mapGhPr(repo, pr)), warnings };
}
