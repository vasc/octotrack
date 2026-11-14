import { rmSync } from "node:fs";
import { join } from "node:path";
import { type Caller, contracts, Hub, Tracker } from "@octotrack/core";
import { createApp } from "./app.ts";
import { currentDashboard, dashboardAssets } from "./dashboard.ts";
import { fetchRepoPrs } from "./gh.ts";
import { loadAllowedHosts } from "./hosts.ts";
import { allowedHostsPath, databasePath, serverStoppedPath, wakeAdaptersPath } from "./paths.ts";
import { cachedRemoteOf } from "./remotes.ts";
import { openSqlite } from "./sqlite.ts";
import { createWakeDispatcher, loadWakeAdapters } from "./wake.ts";

const WEB_DIST = join(import.meta.dir, "../../web/dist");
const SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_PR_SYNC_SECONDS = 120;
// Long polls hold for 25 seconds and streams ping every 15, so a connection is never idle for this long.
const IDLE_TIMEOUT_SECONDS = 120;

const GITHUB_CALLER: Caller = { actor: "github", channel: "cli", system: true };

export function prSyncSeconds(): number {
  const raw = process.env.OCTO_PR_SYNC_SECONDS;
  const parsed = raw === undefined ? DEFAULT_PR_SYNC_SECONDS : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PR_SYNC_SECONDS;
}

export interface RunningServer {
  url: string;
  stop(): void;
}

export function startServer(port: number, hostname = "127.0.0.1"): RunningServer {
  rmSync(serverStoppedPath(), { force: true });
  const tracker = new Tracker(openSqlite(databasePath()), undefined, { remoteOf: cachedRemoteOf() });
  const hub = new Hub(tracker);

  let syncing = false;
  const syncPrs = async () => {
    const projects = tracker.call(contracts.projectList, {}, GITHUB_CALLER);
    const repos = [
      ...new Set(projects.flatMap((card) => (card.project.repo === null ? [] : [card.project.repo]))),
    ];
    const errors: string[] = [];
    let synced = 0;
    if (syncing) return { repos: repos.length, synced, errors: ["A sync is already running"] };
    syncing = true;
    try {
      for (const repo of repos) {
        try {
          const tracked = tracker.call(
            contracts.prList,
            { query: `repo:${repo} state:open,draft`, limit: 1000 },
            GITHUB_CALLER,
          );
          const { prs, warnings } = await fetchRepoPrs(
            repo,
            tracked.map((card) => card.pr.number),
          );
          errors.push(...warnings);
          const failures = warnings.length === 0 ? [] : [{ repo, error: warnings.join("; ") }];
          synced += tracker.call(contracts.prSync, { prs, repos: [repo], failures }, GITHUB_CALLER).synced;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
          // Recorded, not just logged: failing quietly here would leave stale PR status looking current.
          tracker.call(contracts.prSync, { prs: [], failures: [{ repo, error: message }] }, GITHUB_CALLER);
        }
      }
    } finally {
      syncing = false;
    }
    for (const error of errors) console.error(`[pr-sync] ${error}`);
    return { repos: repos.length, synced, errors };
  };

  const app = createApp({
    tracker,
    hub,
    assets: dashboardAssets(currentDashboard(WEB_DIST)),
    syncPrs,
    allowedHosts: loadAllowedHosts(allowedHostsPath()),
  });
  const server = Bun.serve({ port, hostname, idleTimeout: IDLE_TIMEOUT_SECONDS, fetch: app.fetch });

  const wakes = createWakeDispatcher({ tracker, adapters: loadWakeAdapters(wakeAdaptersPath()) });
  const stopWakes = wakes.listen();
  // Anything answered while the server was down.
  void wakes.dispatch();

  const timers = [
    setInterval(() => {
      try {
        tracker.sweep();
      } catch (error) {
        console.error("[sweep]", error);
      }
    }, SWEEP_INTERVAL_MS),
  ];
  const syncSeconds = prSyncSeconds();
  if (syncSeconds > 0) {
    timers.push(setInterval(() => void syncPrs(), syncSeconds * 1000));
    void syncPrs();
  }

  return {
    url: `http://${hostname}:${server.port}`,
    stop() {
      for (const timer of timers) clearInterval(timer);
      stopWakes();
      server.stop(true);
    },
  };
}
