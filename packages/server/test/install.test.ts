import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, type CommandRunner, install, pointPlistAt, rollback } from "../src/install.ts";

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ink.example.octotrack.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/me/.bun/bin/bun</string>
    <string>/Users/me/.bun/bin/octo</string>
    <string>serve</string>
  </array>
  <key>StandardOutPath</key>
  <string>/Users/me/.octotrack/server.log</string>
</dict>
</plist>
`;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scene() {
  const root = mkdtempSync(join(tmpdir(), "octo-install-"));
  dirs.push(root);
  const checkout = join(root, "checkout", "main.ts");
  mkdirSync(join(root, "checkout"));
  writeFileSync(checkout, "script");
  mkdirSync(join(root, "bin"));
  const paths = {
    binDir: join(root, "home", "bin"),
    link: join(root, "bin", "octo"),
    plist: join(root, "agent.plist"),
    wakeAdapters: join(root, "wake-adapters.json"),
  };
  symlinkSync(checkout, paths.link);
  writeFileSync(paths.plist, PLIST);
  writeFileSync(
    paths.wakeAdapters,
    JSON.stringify({ claude: { command: ["bun", "/checkout/claude.ts", "{address}", "{message}"] } }),
  );
  const built = join(root, "octo-built");
  writeFileSync(built, "binary one");
  const commands: string[][] = [];
  const run: CommandRunner = (command) => {
    commands.push([...command]);
    return { code: 0, output: "" };
  };
  return { root, checkout, paths, built, commands, run };
}

describe("installing the binary as the live Octotrack", () => {
  test("points the PATH link, the LaunchAgent and the wake adapter at it, and restarts the server", () => {
    const s = scene();
    const report = install(s.built, s.paths, s.run, 501);
    const binary = join(s.paths.binDir, "octo");
    expect(readFileSync(binary, "utf8")).toBe("binary one");
    expect(readlinkSync(s.paths.link)).toBe(binary);
    const plist = readFileSync(s.paths.plist, "utf8");
    expect(plist).toContain(`<string>${binary}</string>\n    <string>serve</string>`);
    expect(plist).not.toContain(".bun/bin/bun");
    expect(plist).toContain("<string>/Users/me/.octotrack/server.log</string>");
    expect(JSON.parse(readFileSync(s.paths.wakeAdapters, "utf8")).claude.command).toEqual([
      binary,
      "adapter",
      "claude",
      "--",
      "{address}",
      "{message}",
    ]);
    expect(s.commands).toEqual([
      ["launchctl", "bootout", "gui/501", s.paths.plist],
      ["launchctl", "bootstrap", "gui/501", s.paths.plist],
    ]);
    expect(report.changed).toContain(s.paths.plist);
  });

  test("rollback after the first deploy goes back to running from the checkout", () => {
    const s = scene();
    const wakeBefore = readFileSync(s.paths.wakeAdapters, "utf8");
    install(s.built, s.paths, s.run, 501);
    rollback(s.paths, s.run, 501);
    expect(readlinkSync(s.paths.link)).toBe(s.checkout);
    expect(readFileSync(s.paths.plist, "utf8")).toBe(PLIST);
    expect(readFileSync(s.paths.wakeAdapters, "utf8")).toBe(wakeBefore);
  });

  test("rollback after a later deploy goes back one deploy, to the binary before it", () => {
    const s = scene();
    install(s.built, s.paths, s.run, 501);
    const plistAfterFirst = readFileSync(s.paths.plist, "utf8");
    writeFileSync(s.built, "binary two");
    install(s.built, s.paths, s.run, 501);
    rollback(s.paths, s.run, 501);
    const binary = join(s.paths.binDir, "octo");
    expect(readFileSync(binary, "utf8")).toBe("binary one");
    expect(readlinkSync(s.paths.link)).toBe(binary);
    expect(readFileSync(s.paths.plist, "utf8")).toBe(plistAfterFirst);
  });

  test("rollback puts a new file in the binary's place rather than writing over the one that is running", () => {
    const s = scene();
    install(s.built, s.paths, s.run, 501);
    writeFileSync(s.built, "binary two");
    install(s.built, s.paths, s.run, 501);
    const binary = join(s.paths.binDir, "octo");
    const running = statSync(binary).ino;
    rollback(s.paths, s.run, 501);
    expect(statSync(binary).ino).not.toBe(running);
    expect(readFileSync(binary, "utf8")).toBe("binary one");
  });

  test("a LaunchAgent with no program is refused rather than silently left as it was", () => {
    expect(() => pointPlistAt("<plist><dict></dict></plist>", ["/bin/octo", "serve"])).toThrow(
      "ProgramArguments",
    );
  });

  test("a failed restart is an error, not a quiet success", () => {
    const s = scene();
    const failing: CommandRunner = (command) => ({
      code: command[1] === "bootstrap" ? 5 : 0,
      output: "Bootstrap failed",
    });
    expect(() => install(s.built, s.paths, failing, 501)).toThrow("Bootstrap failed");
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
