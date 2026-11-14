/**
 * Deploys Octotrack as one binary and makes it the live install: build, rehearse the migration on a copy of the real
 * database, back the database up when the schema moves, install, restart, and check the server that answers is the new
 * build. `--rollback` puts back what the last deploy changed; the database is never touched by a rollback.
 * Usage: bun scripts/deploy.ts [--rollback]
 */
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA_VERSION } from "../packages/core/src/index.ts";
import {
  backupDatabase,
  type CommandRunner,
  type InstallPaths,
  install,
  rollback,
} from "../packages/server/src/install.ts";
import { DEFAULT_PORT } from "../packages/server/src/paths.ts";
import { rehearseCopy } from "../packages/server/src/rehearse.ts";
import { buildBinary } from "./build-binary.ts";

/** A restart takes about a second; this is twice the slowest seen, then it stops and says what it saw. */
const HEALTH_DEADLINE_MS = 10_000;

const home = process.env.OCTO_HOME ?? join(homedir(), ".octotrack");
const database = join(home, "octo.db");
const agents = join(homedir(), "Library", "LaunchAgents");
const plist = readdirSync(agents).find((name) => name.includes("octotrack") && name.endsWith(".plist"));
if (plist === undefined) throw new Error(`No Octotrack LaunchAgent in ${agents}`);
const paths: InstallPaths = {
  binDir: join(home, "bin"),
  link: Bun.which("octo") ?? join(homedir(), ".bun", "bin", "octo"),
  plist: join(agents, plist),
  wakeAdapters: join(home, "wake-adapters.json"),
};
const run: CommandRunner = (command) => {
  const result = Bun.spawnSync([...command], { stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode, output: `${result.stdout.toString()}${result.stderr.toString()}` };
};

function schemaOf(path: string): number {
  const db = new Database(path, { readonly: true });
  try {
    const row = db.query("PRAGMA user_version").get();
    return typeof row === "object" &&
      row !== null &&
      "user_version" in row &&
      typeof row.user_version === "number"
      ? row.user_version
      : 0;
  } finally {
    db.close();
  }
}

async function answeringBuild(): Promise<string | null> {
  const url = `http://127.0.0.1:${process.env.OCTO_PORT ?? DEFAULT_PORT}/api/health`;
  const deadline = Date.now() + HEALTH_DEADLINE_MS;
  let seen = "nothing answered";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const build = response.headers.get("x-octo-build");
      if (response.ok && build !== null) return build;
      seen = `HTTP ${response.status}`;
    } catch (error) {
      seen = error instanceof Error ? error.message : String(error);
    }
    await Bun.sleep(200);
  }
  console.error(`The server did not answer within ${HEALTH_DEADLINE_MS} ms: ${seen}`);
  return null;
}

if (process.argv.includes("--rollback")) {
  const restored = rollback(paths, run);
  console.log(restored.length === 0 ? "Nothing to roll back." : `Put back:\n  ${restored.join("\n  ")}`);
  console.log("The database was left as it is.");
} else {
  const { binary, buildId } = buildBinary();
  if (existsSync(database)) {
    const { report } = rehearseCopy(database, mkdtempSync(join(tmpdir(), "octo-deploy-")));
    if (report.problems.length > 0) {
      console.error(
        `The migration would lose data, so nothing was deployed:\n  ${report.problems.join("\n  ")}`,
      );
      process.exit(1);
    }
    const before = schemaOf(database);
    if (before < SCHEMA_VERSION) {
      const backup = backupDatabase(database, join(home, `octo-backup-before-v${SCHEMA_VERSION}.db`));
      console.log(`Schema ${before} → ${SCHEMA_VERSION}. Backed up to ${backup}`);
    }
  }
  const report = install(binary, paths, run);
  console.log(`Installed ${report.binary}. Changed:\n  ${report.changed.join("\n  ")}`);
  const answering = await answeringBuild();
  if (answering !== buildId) {
    console.error(
      `Expected build ${buildId} to answer, got ${answering ?? "none"}. Roll back with --rollback.`,
    );
    process.exit(1);
  }
  console.log(`Build ${buildId} is live.`);
}
