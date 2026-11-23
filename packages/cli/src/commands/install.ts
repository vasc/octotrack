import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA_VERSION } from "@octotrack/core";
import { BUILD_ID } from "@octotrack/server/build";
import { backupDatabase, placeBinary, restorePrevious, schemaVersionOf } from "@octotrack/server/install";
import { databasePath, octoHome, serverStoppedPath } from "@octotrack/server/paths";
import { rehearseCopy } from "@octotrack/server/rehearse";
import { UsageError } from "../args.ts";
import { ConnectionError, OctoClient, RemoteError } from "../client.ts";
import type { Command } from "../command.ts";
import { printError } from "../write.ts";
import { Health } from "./system.ts";

/** A server stops in well under a second; this is about twice the slowest seen, then it says what it saw. */
const STOP_DEADLINE_MS = 10_000;
const STOP_POLL_MS = 100;

function binDir(): string {
  return join(octoHome(), "bin");
}

/** Ends the server answering now, if any, and waits until it no longer answers. */
async function stopServer(client: OctoClient): Promise<void> {
  const quiet = client.withoutAutoStart().silenceBuildWarning();
  let pid: number | null;
  try {
    pid = Health.parse(await quiet.get("/api/health")).pid;
  } catch (error) {
    if (error instanceof ConnectionError) return;
    throw error;
  }
  if (pid !== null) process.kill(pid, "SIGTERM");
  const deadline = Date.now() + STOP_DEADLINE_MS;
  while (Date.now() < deadline) {
    try {
      await quiet.get("/api/health");
    } catch (error) {
      if (error instanceof ConnectionError) return;
      throw error;
    }
    await Bun.sleep(STOP_POLL_MS);
  }
  throw new RemoteError({
    code: "conflict",
    message: `The server at ${client.baseUrl}, pid ${pid ?? "unknown"}, still answered ${STOP_DEADLINE_MS} ms after being asked to stop`,
    hint: "Stop it yourself, then run this again.",
  });
}

/** Restarts the server on `binary` and returns the build that answers. */
async function restartOn(client: OctoClient, binary: string): Promise<string> {
  await stopServer(client);
  rmSync(serverStoppedPath(), { force: true });
  const fresh = new OctoClient(
    client.baseUrl,
    client.actor,
    [binary],
    true,
    client.identity,
  ).silenceBuildWarning();
  return Health.parse(await fresh.get("/api/health")).build ?? "unknown";
}

/** Says so when the `octo` a shell finds is not the one just installed. */
function pathHint(binary: string): string | null {
  const found = Bun.which("octo");
  if (found !== null && realpathSync(found) === realpathSync(binary)) return null;
  return `The octo on your PATH is ${found ?? "missing"}. Put ${binDir()} on your PATH to run this one.`;
}

export const installCommands: Command[] = [
  {
    path: ["install"],
    summary: "Install this built octo and restart the server on it, after rehearsing the migration on a copy",
    examples: ["bun run build && build/octo install"],
    ops: [],
    async run({ client, out }) {
      if (BUILD_ID === "dev") {
        throw new UsageError("Install runs from the built file: run bun run build, then build/octo install");
      }
      const database = databasePath();
      let backup: string | null = null;
      if (existsSync(database)) {
        const work = mkdtempSync(join(tmpdir(), "octo-install-"));
        try {
          const { report } = rehearseCopy(database, work);
          if (report.problems.length > 0) {
            throw new RemoteError({
              code: "conflict",
              message: `The migration would lose data, so nothing was installed: ${report.problems.join("; ")}`,
              hint: null,
            });
          }
        } finally {
          rmSync(work, { recursive: true, force: true });
        }
        const before = schemaVersionOf(database);
        if (before < SCHEMA_VERSION) {
          backup = backupDatabase(database, join(octoHome(), `octo-backup-before-v${SCHEMA_VERSION}.db`));
        }
      }
      const binary = placeBinary(process.execPath, binDir());
      const answering = await restartOn(client, binary);
      if (answering !== BUILD_ID) {
        throw new RemoteError({
          code: "conflict",
          message: `Installed build ${BUILD_ID} at ${binary}, but build ${answering} answers at ${client.baseUrl}`,
          hint: "Run octo rollback to put the one before back.",
        });
      }
      const hint = pathHint(binary);
      if (hint !== null) printError(hint);
      out.data({ binary, build: BUILD_ID, backup }, () =>
        [
          ...(backup === null ? [] : [`Backed the database up to ${backup}`]),
          `Build ${BUILD_ID} is installed at ${binary} and answering at ${client.baseUrl}.`,
        ].join("\n"),
      );
    },
  },
  {
    path: ["rollback"],
    summary:
      "Put back the octo from before the last install and restart the server on it. The database is left alone",
    ops: [],
    async run({ client, out }) {
      const binary = restorePrevious(binDir());
      if (binary === null) {
        throw new RemoteError({
          code: "nothing_to_roll_back",
          message: `There is no octo from before the last install in ${binDir()}`,
          hint: null,
        });
      }
      const build = await restartOn(client, binary);
      out.data(
        { binary, build },
        () => `Put back build ${build} at ${binary}. The database was left as it is.`,
      );
    },
  },
];
