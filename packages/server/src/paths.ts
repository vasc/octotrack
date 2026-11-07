import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_PORT = 4747;

export function octoHome(): string {
  const home = process.env.OCTO_HOME ?? join(homedir(), ".octotrack");
  mkdirSync(home, { recursive: true });
  return home;
}

export function databasePath(): string {
  return join(octoHome(), "octo.db");
}

export function serverLogPath(): string {
  return join(octoHome(), "server.log");
}

/** Present after `octo server stop`, so that a waiting agent does not start the server right back up. */
export function serverStoppedPath(): string {
  return join(octoHome(), "stopped");
}

export function serverUrl(): string {
  return (process.env.OCTO_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/$/, "");
}
