import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, placeBinary, restorePrevious } from "../src/install.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scene() {
  const root = mkdtempSync(join(tmpdir(), "octo-install-"));
  dirs.push(root);
  const binDir = join(root, "home", "bin");
  const built = join(root, "octo-built");
  writeFileSync(built, "binary one");
  return { root, binDir, built, binary: join(binDir, "octo") };
}

describe("putting a built file in place as the live octo", () => {
  test("the first install creates the folder and puts the file there, runnable", () => {
    const s = scene();
    expect(placeBinary(s.built, s.binDir)).toBe(s.binary);
    expect(readFileSync(s.binary, "utf8")).toBe("binary one");
    expect(statSync(s.binary).mode & 0o111).not.toBe(0);
    expect(existsSync(`${s.binary}.previous`)).toBe(false);
  });

  test("a later install keeps the one before it, and puts a new file in place rather than writing over the running one", () => {
    const s = scene();
    placeBinary(s.built, s.binDir);
    const running = statSync(s.binary).ino;
    writeFileSync(s.built, "binary two");
    placeBinary(s.built, s.binDir);
    expect(readFileSync(s.binary, "utf8")).toBe("binary two");
    expect(readFileSync(`${s.binary}.previous`, "utf8")).toBe("binary one");
    expect(statSync(s.binary).ino).not.toBe(running);
  });

  test("rollback puts the one before back, as a new file, and goes back exactly one install", () => {
    const s = scene();
    placeBinary(s.built, s.binDir);
    writeFileSync(s.built, "binary two");
    placeBinary(s.built, s.binDir);
    const running = statSync(s.binary).ino;
    expect(restorePrevious(s.binDir)).toBe(s.binary);
    expect(readFileSync(s.binary, "utf8")).toBe("binary one");
    expect(statSync(s.binary).ino).not.toBe(running);
  });

  test("rollback with nothing before it changes nothing and says so", () => {
    const s = scene();
    expect(restorePrevious(s.binDir)).toBeNull();
    placeBinary(s.built, s.binDir);
    expect(restorePrevious(s.binDir)).toBeNull();
    expect(readFileSync(s.binary, "utf8")).toBe("binary one");
  });
});

describe("backing up the database", () => {
  test("takes in writes still in the WAL, and never overwrites an earlier backup", () => {
    const s = scene();
    const source = join(s.root, "octo.db");
    const live = new Database(source);
    live.run("PRAGMA journal_mode = WAL");
    live.run("CREATE TABLE things (name TEXT)");
    live.run("INSERT INTO things VALUES ('in the wal')");
    const target = join(s.root, "octo-backup-before-v6.db");
    const first = backupDatabase(source, target);
    const second = backupDatabase(source, target);
    live.close();
    expect(first).toBe(target);
    expect(second).not.toBe(target);
    const copy = new Database(first, { readonly: true });
    expect(copy.query("SELECT name FROM things").all()).toEqual([{ name: "in the wal" }]);
    copy.close();
  });
});
