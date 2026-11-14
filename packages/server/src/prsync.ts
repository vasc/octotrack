import { type Caller, contracts, type Tracker } from "@octotrack/core";
import { fetchRepoPrs, type RepoPrs } from "./gh.ts";

const GITHUB_CALLER: Caller = { actor: "github", channel: "cli", system: true };
/** A GitHub owner/name, which is all a repo given to gh may be: nothing it could read as an option. */
const REPO = /^[A-Za-z0-9_.][A-Za-z0-9_.-]*\/[A-Za-z0-9_.][A-Za-z0-9_.-]*$/;

export interface PrSyncResult {
  /** How many repos were asked about. */
  repos: number;
  synced: number;
  /** Pull requests whose row changed. */
  changed: string[];
  errors: string[];
}

export type PrSync = (only?: readonly string[]) => Promise<PrSyncResult>;

/**
 * Pulls pull request state from GitHub with the server's own gh and reports it as GitHub sync, the only caller besides
 * the developer that may (docs/DESIGN.md, D13). `octo pr sync` asks for this rather than reporting what it fetched,
 * so no agent's report is ever taken as GitHub's. One unreachable repo does not stop the others.
 */
export function createPrSync(tracker: Tracker, fetch: typeof fetchRepoPrs = fetchRepoPrs): PrSync {
  let syncing = false;
  return async (only) => {
    const named = [
      ...new Set(
        tracker
          .call(contracts.projectList, {}, GITHUB_CALLER)
          .flatMap((card) => (card.project.repo === null ? [] : [card.project.repo])),
      ),
    ];
    const asked = only === undefined || only.length === 0 ? named : [...new Set(only)];
    const errors: string[] = [];
    const changed: string[] = [];
    let synced = 0;
    if (syncing) return { repos: asked.length, synced, changed, errors: ["A sync is already running"] };
    syncing = true;
    try {
      for (const repo of asked) {
        if (!REPO.test(repo)) {
          errors.push(`${repo} is not a GitHub repo's owner/name`);
          continue;
        }
        let fetched: RepoPrs;
        try {
          const tracked = tracker.call(
            contracts.prList,
            { query: `repo:${repo} state:open,draft`, limit: 1000 },
            GITHUB_CALLER,
          );
          fetched = await fetch(
            repo,
            tracked.map((card) => card.pr.number),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
          // Recorded, not just logged: failing quietly here would leave stale PR status looking current.
          tracker.call(contracts.prSync, { prs: [], failures: [{ repo, error: message }] }, GITHUB_CALLER);
          continue;
        }
        errors.push(...fetched.warnings);
        const failures = fetched.warnings.length === 0 ? [] : [{ repo, error: fetched.warnings.join("; ") }];
        const outcome = tracker.call(
          contracts.prSync,
          { prs: fetched.prs, repos: [repo], failures },
          GITHUB_CALLER,
        );
        synced += outcome.synced;
        changed.push(...outcome.changed);
      }
    } finally {
      syncing = false;
    }
    for (const error of errors) console.error(`[pr-sync] ${error}`);
    return { repos: asked.length, synced, changed, errors };
  };
}
