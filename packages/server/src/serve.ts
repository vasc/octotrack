import { existsSync, rmSync } from "node:fs";
import { join, normalize } from "node:path";
import { type Caller, contracts, Hub, Tracker } from "@octotrack/core";
import { createApp } from "./app.ts";
import { fetchRepoPrs } from "./gh.ts";
import { loadAllowedHosts } from "./hosts.ts";
import { allowedHostsPath, databasePath, serverStoppedPath } from "./paths.ts";
import { openSqlite } from "./sqlite.ts";

const WEB_DIST = join(import.meta.dir, "../../web/dist");
const SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_PR_SYNC_SECONDS = 120;
// Long polls hold for 25 seconds and streams ping every 15, so a connection is never idle for this long.
const IDLE_TIMEOUT_SECONDS = 120;

const GITHUB_CALLER: Caller = { actor: "github", channel: "cli" };

async function serveAsset(path: string): Promise<Response | null> {
  if (!existsSync(join(WEB_DIST, "index.html"))) return null;
  const relative = normalize(path).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(WEB_DIST, relative);
  if (relative.startsWith("/assets/") && candidate.startsWith(WEB_DIST) && existsSync(candidate)) {
    // File names are content hashes, so these can be cached forever.
    return new Response(Bun.file(candidate), {
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    });
  }
  return new Response(Bun.file(join(WEB_DIST, "index.html")), { headers: { "cache-control": "no-cache" } });
}

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
  const tracker = new Tracker(openSqlite(databasePath()));
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
    assets: serveAsset,
    syncPrs,
    allowedHosts: loadAllowedHosts(allowedHostsPath()),
  });
  const server = Bun.serve({ port, hostname, idleTimeout: IDLE_TIMEOUT_SECONDS, fetch: app.fetch });

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
      server.stop(true);
    },
  };
}
