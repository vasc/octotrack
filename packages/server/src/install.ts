import { Database } from "bun:sqlite";
import { chmodSync, copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const PREVIOUS = ".previous";

/**
 * Puts a built octo in `binDir` as the live one, keeping the one before it as `octo.previous`. The new file is renamed
 * into place, never written over the old one, which may be running.
 */
export function placeBinary(built: string, binDir: string): string {
  mkdirSync(binDir, { recursive: true });
  const binary = join(binDir, "octo");
  if (existsSync(binary)) copyFileSync(binary, `${binary}${PREVIOUS}`);
  const incoming = `${binary}.next`;
  copyFileSync(built, incoming);
  chmodSync(incoming, 0o755);
  renameSync(incoming, binary);
  return binary;
}

/** Puts back the octo from before the last install, as a new file; null when there is none to put back. */
export function restorePrevious(binDir: string): string | null {
  const binary = join(binDir, "octo");
  const previous = `${binary}${PREVIOUS}`;
  if (!existsSync(previous)) return null;
  renameSync(previous, binary);
  return binary;
}

/** The schema version a database is at, read without migrating it. */
export function schemaVersionOf(path: string): number {
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
