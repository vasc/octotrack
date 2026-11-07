import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hub, Tracker } from "@octotrack/core";
import { createApp, DEFAULT_HOSTS } from "../src/app.ts";
import { loadAllowedHosts } from "../src/hosts.ts";
import { openSqlite } from "../src/sqlite.ts";

const TAILNET_HOST = "mini.example.ts.net";
const dirs: string[] = [];

function fileWith(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "octo-hosts-"));
  dirs.push(dir);
  const path = join(dir, "allowed-hosts");
  writeFileSync(path, content);
  return path;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadAllowedHosts", () => {
  test("is the loopback names when there is no file", () => {
    expect(loadAllowedHosts(join(tmpdir(), "octo-no-such-file"))).toEqual([...DEFAULT_HOSTS]);
  });

  test("adds the names in the file, skipping blanks and comments", () => {
    const path = fileWith(`# The tailnet name of this machine\n\n  ${TAILNET_HOST}  \n`);
    expect(loadAllowedHosts(path)).toEqual([...DEFAULT_HOSTS, TAILNET_HOST]);
  });
});

describe("a server reached through a proxy on another name", () => {
  const appWith = (allowedHosts: readonly string[]) => {
    const tracker = new Tracker(openSqlite(":memory:"));
    return createApp({ tracker, hub: new Hub(tracker), allowedHosts });
  };

  test("answers on a listed name", async () => {
    const app = appWith(loadAllowedHosts(fileWith(`${TAILNET_HOST}\n`)));
    const response = await app.request(`https://${TAILNET_HOST}/api/health`, {
      headers: { host: TAILNET_HOST },
    });
    expect(response.status).toBe(200);
  });

  test("still refuses every other name, so listing one does not reopen DNS rebinding", async () => {
    const app = appWith(loadAllowedHosts(fileWith(`${TAILNET_HOST}\n`)));
    const response = await app.request("http://evil.example/api/health", {
      headers: { host: "evil.example" },
    });
    expect(response.status).toBe(403);
  });

  test("still answers on loopback, which the CLI depends on", async () => {
    const app = appWith(loadAllowedHosts(fileWith(`${TAILNET_HOST}\n`)));
    const response = await app.request("http://127.0.0.1:4747/api/health", {
      headers: { host: "127.0.0.1:4747" },
    });
    expect(response.status).toBe(200);
  });
});
