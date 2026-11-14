import { rmSync } from "node:fs";
import { join } from "node:path";
import { type Caller, contracts, Hub, Tracker } from "@octotrack/core";
import { createApp } from "./app.ts";
import { currentDashboard, dashboardAssets } from "./dashboard.ts";
import { loadAllowedHosts } from "./hosts.ts";
import {
  agentSetupPath,
  allowedHostsPath,
  databasePath,
  serverStoppedPath,
  vapidPath,
  wakeAdaptersPath,
} from "./paths.ts";
import { createPrSync } from "./prsync.ts";
import { createPushDispatcher, loadOrCreateVapid, webPushSender } from "./push.ts";
import { createRunner, loadRunnerConfig } from "./runner.ts";
import { cachedRemoteOf } from "./remotes.ts";
import { openSqlite } from "./sqlite.ts";
import { createWakeDispatcher, loadWakeAdapters } from "./wake.ts";

const WEB_DIST = join(import.meta.dir, "../../web/dist");
const SWEEP_INTERVAL_MS = 60_000;
const CHOICE_TICK_MS = 1000;
// A line's owner search reaches the runner 30 seconds after it starts; this keeps the wait short without spinning.
const RUNNER_TICK_MS = 10_000;
const DEFAULT_PR_SYNC_SECONDS = 120;
// Long polls hold for 25 seconds and streams ping every 15, so a connection is never idle for this long.
const IDLE_TIMEOUT_SECONDS = 120;

const OCTOTRACK: Caller = { actor: "octotrack", channel: "cli", system: true };

/**
 * Who push services may contact about these notifications. VAPID asks for a mailto: or https: address; set
 * OCTO_PUSH_CONTACT to one of yours, since nothing about the developer is sent without them choosing to.
 */
function pushContact(): string {
  return process.env.OCTO_PUSH_CONTACT ?? "mailto:octotrack@localhost";
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
  const tracker = new Tracker(openSqlite(databasePath()), undefined, { remoteOf: cachedRemoteOf() });
  const hub = new Hub(tracker);

  const syncPrs = createPrSync(tracker);

  const vapid = loadOrCreateVapid(vapidPath());
  const push = createPushDispatcher({ tracker, send: webPushSender(vapid, pushContact()) });
  const stopPush = push.listen();
  const app = createApp({
    tracker,
    hub,
    assets: dashboardAssets(currentDashboard(WEB_DIST)),
    syncPrs,
    allowedHosts: loadAllowedHosts(allowedHostsPath()),
    pushKey: vapid.publicKey,
  });
  const server = Bun.serve({ port, hostname, idleTimeout: IDLE_TIMEOUT_SECONDS, fetch: app.fetch });

  const wakes = createWakeDispatcher({ tracker, adapters: loadWakeAdapters(wakeAdaptersPath()) });

  // With no setup file, nothing is started, and home says so where a line needs an owner.
  const runnerConfig = loadRunnerConfig(agentSetupPath());
  const runner = runnerConfig === null ? null : createRunner({ tracker, config: runnerConfig });
  if (runner === null) {
    tracker.call(contracts.runnerReport, { configured: false, cap: 0, dryRun: true }, OCTOTRACK);
  }
  const runOnce = () => {
    void runner?.tick().catch((error) => console.error("[runner]", error));
  };
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
    // A choice's Undo window ends on time even when nobody calls the server.
    setInterval(() => {
      try {
        tracker.applyDueChoices();
      } catch (error) {
        console.error("[choices]", error);
      }
    }, CHOICE_TICK_MS),
    setInterval(runOnce, RUNNER_TICK_MS),
    // Step in becomes due by time alone, so notifications are checked on a tick as well as on every change.
    setInterval(() => void push.dispatch(), RUNNER_TICK_MS),
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
      stopPush();
      server.stop(true);
    },
  };
}
