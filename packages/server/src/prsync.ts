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

export type PrSync = (
  only?: readonly string[],
  options?: {
    /**
     * Wait for a sync already running, then run, rather than answer that one is running: the scheduled sync, so that a
     * sync someone asked for never costs the next interval's (fourth audit, A24).
     */
    wait?: boolean;
  },
) => Promise<PrSyncResult>;

/**
 * Pulls pull request state from GitHub with the server's own gh and reports it as GitHub sync, the only caller besides
 * the developer that may (docs/DESIGN.md, D13). `octo pr sync` asks for this rather than reporting what it fetched,
 * so no agent's report is ever taken as GitHub's. Only repos a project here names are synced (D11): one asked for that
 * none names is reported and never fetched, so no caller can have the server run gh for, and write the pull requests
 * of, any repo it likes. One unreachable repo does not stop the others.
 */
export function createPrSync(tracker: Tracker, fetch: typeof fetchRepoPrs = fetchRepoPrs): PrSync {
  /** The sync under way, if any, and the one waiting to run after it: waiting syncs share a single run. */
  let running: Promise<unknown> | null = null;
  let waiting: Promise<PrSyncResult> | null = null;

  const named = () => [
    ...new Set(
      tracker
        .call(contracts.projectList, {}, GITHUB_CALLER)
        .flatMap((card) => (card.project.repo === null ? [] : [card.project.repo])),
    ),
  ];

  /** Syncs each repo in turn, recording a failure as GitHub's rather than only logging it. */
  const syncRepos = async (repos: readonly string[]): Promise<Omit<PrSyncResult, "repos">> => {
    const errors: string[] = [];
    const changed: string[] = [];
    let synced = 0;
    for (const repo of repos) {
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
    return { synced, changed, errors };
  };

  const sync: PrSync = async (only, options) => {
    if (running !== null) {
      if (options?.wait !== true) {
        return { repos: only?.length ?? 0, synced: 0, changed: [], errors: ["A sync is already running"] };
      }
      // One run after the current one serves every sync that waits for it; only the scheduled, whole sync waits.
      if (waiting === null) {
        waiting = running.then(() => {
          waiting = null;
          return sync(only, options);
        });
      }
      return waiting;
    }
    const known = named();
    const byName = new Map(known.map((repo) => [repo.toLowerCase(), repo]));
    const requested = only === undefined || only.length === 0 ? known : [...new Set(only)];
    const refused: string[] = [];
    const repos: string[] = [];
    for (const repo of requested) {
      const project = byName.get(repo.toLowerCase());
      if (!REPO.test(repo)) refused.push(`${repo} is not a GitHub repo's owner/name`);
      else if (project === undefined) refused.push(`${repo} is not a repo any project here names`);
      else if (!repos.includes(project)) repos.push(project);
    }
    const run = syncRepos(repos);
    const clear = () => {
      running = null;
    };
    running = run.then(clear, clear);
    const outcome = await run;
    const errors = [...refused, ...outcome.errors];
    for (const error of errors) console.error(`[pr-sync] ${error}`);
    return { repos: requested.length, ...outcome, errors };
  };
  return sync;
}
