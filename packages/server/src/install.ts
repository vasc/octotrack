import { Database } from "bun:sqlite";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

/** Everything a deploy touches. Tests point these at a scratch folder. */
export interface InstallPaths {
  /** Where binaries live: the current one as `octo`, the one before it as `octo.previous`. */
  binDir: string;
  /** The `octo` on the developer's PATH, a symlink. */
  link: string;
  /** The LaunchAgent that keeps the server running. */
  plist: string;
  wakeAdapters: string;
}

/** Runs a command and says how it went. Injected, so tests never call launchctl. */
export type CommandRunner = (command: readonly string[]) => { code: number; output: string };

export interface InstallReport {
  binary: string;
  changed: string[];
}

const PREVIOUS = ".previous";

/** Keeps the file as it was before a deploy changed it, so that rollback can put it back. */
function keepPrevious(path: string): void {
  if (existsSync(path)) copyFileSync(path, `${path}${PREVIOUS}`);
}

/** Every deploy keeps what it found, changed or not, so that rollback is always exactly one deploy back. */
function writeIfChanged(path: string, next: string, changed: string[]): void {
  keepPrevious(path);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === next) return;
  writeFileSync(path, next);
  changed.push(path);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The LaunchAgent with its program replaced; everything else in it, such as its log paths, stays as it was. */
export function pointPlistAt(plist: string, program: readonly string[]): string {
  const array = program.map((part) => `    <string>${escapeXml(part)}</string>`).join("\n");
  const replaced = plist.replace(
    /(<key>ProgramArguments<\/key>\s*)<array>[\s\S]*?<\/array>/,
    `$1<array>\n${array}\n  </array>`,
  );
  if (replaced === plist && !plist.includes("<key>ProgramArguments</key>")) {
    throw new Error("The LaunchAgent has no ProgramArguments to point at the binary");
  }
  return replaced;
}

const WakeAdapters = z.record(z.string(), z.object({ command: z.array(z.string()) }).loose());

/**
 * The wake adapters without any that run `adapter` on this binary, given every path it runs from. The binary has no
 * `adapter` command any more, so such an entry could only fail. Every other entry is left as the developer wrote it, and
 * with nothing to remove the text comes back unchanged, so the file is not rewritten.
 */
export function removeAdaptersRunning(json: string, binaries: readonly string[]): string {
  const adapters = WakeAdapters.parse(JSON.parse(json));
  const kept = Object.entries(adapters).filter(([, adapter]) => {
    const [program, subcommand] = adapter.command;
    return !(program !== undefined && binaries.includes(program) && subcommand === "adapter");
  });
  if (kept.length === Object.keys(adapters).length) return json;
  return `${JSON.stringify(Object.fromEntries(kept), null, 2)}\n`;
}

function relink(link: string, target: string, changed: string[]): void {
  let current: string | null = null;
  try {
    current = readlinkSync(link);
  } catch {
    current = null;
  }
  if (current !== null) writeFileSync(join(dirname(target), `link${PREVIOUS}`), current);
  if (current === target) return;
  rmSync(link, { force: true });
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link);
  changed.push(link);
}

function restartAgent(plist: string, run: CommandRunner, uid: number): void {
  // Not loaded is fine: bootstrap below loads it either way.
  run(["launchctl", "bootout", `gui/${uid}`, plist]);
  const loaded = run(["launchctl", "bootstrap", `gui/${uid}`, plist]);
  if (loaded.code !== 0) throw new Error(`launchctl bootstrap failed: ${loaded.output.trim()}`);
}

/**
 * Installs a built binary as the live Octotrack: keeps the one before it, points the PATH link and the LaunchAgent at
 * it, removes any wake adapter that runs the binary's old `adapter` command, and restarts the server. Each file it
 * changes is kept as `.previous` first.
 */
export function install(
  built: string,
  paths: InstallPaths,
  run: CommandRunner,
  uid: number = process.getuid?.() ?? 0,
): InstallReport {
  const changed: string[] = [];
  mkdirSync(paths.binDir, { recursive: true });
  const binary = join(paths.binDir, "octo");
  keepPrevious(binary);
  const incoming = `${binary}.next`;
  copyFileSync(built, incoming);
  chmodSync(incoming, 0o755);
  renameSync(incoming, binary);
  changed.push(binary);

  relink(paths.link, binary, changed);
  if (existsSync(paths.wakeAdapters)) {
    writeIfChanged(
      paths.wakeAdapters,
      removeAdaptersRunning(readFileSync(paths.wakeAdapters, "utf8"), [binary, paths.link]),
      changed,
    );
  }
  writeIfChanged(paths.plist, pointPlistAt(readFileSync(paths.plist, "utf8"), [binary, "serve"]), changed);
  restartAgent(paths.plist, run, uid);
  return { binary, changed };
}

/** Puts back what the last deploy changed, and restarts the server. The database is left alone. */
export function rollback(
  paths: InstallPaths,
  run: CommandRunner,
  uid: number = process.getuid?.() ?? 0,
): string[] {
  const restored: string[] = [];
  const binary = join(paths.binDir, "octo");
  for (const path of [binary, paths.plist, paths.wakeAdapters]) {
    if (!existsSync(`${path}${PREVIOUS}`)) continue;
    // A new file renamed into place: writing over a binary that is running can kill it mid-flight.
    const incoming = `${path}.next`;
    copyFileSync(`${path}${PREVIOUS}`, incoming);
    renameSync(incoming, path);
    restored.push(path);
  }
  const previousLink = join(paths.binDir, `link${PREVIOUS}`);
  if (existsSync(previousLink)) {
    rmSync(paths.link, { force: true });
    symlinkSync(readFileSync(previousLink, "utf8"), paths.link);
    restored.push(paths.link);
  }
  restartAgent(paths.plist, run, uid);
  return restored;
}

/**
 * Backs the database up with SQLite itself, from a read-only connection, so that writes still in the WAL come along; a
 * file copy would lose them. Never overwrites an earlier backup.
 */
export function backupDatabase(source: string, target: string): string {
  const path = existsSync(target) ? target.replace(/\.db$/, `-${Date.now()}.db`) : target;
  const db = new Database(source, { readonly: true });
  try {
    db.run("VACUUM INTO ?", [path]);
  } finally {
    db.close();
  }
  return path;
}
