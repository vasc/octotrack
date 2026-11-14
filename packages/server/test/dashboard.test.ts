import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dashboardAssets, fromDist, fromEmbedded } from "../src/dashboard.ts";

const dirs: string[] = [];
function built(): string {
  const dist = mkdtempSync(join(tmpdir(), "octo-dist-"));
  dirs.push(dist);
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "index.html"), "<html>page</html>");
  writeFileSync(join(dist, "assets", "index-abc.js"), "code");
  return dist;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("serving the dashboard", () => {
  test("from a checkout's dist: assets cached forever, every other path gets the page", async () => {
    const serve = dashboardAssets(fromDist(built()));
    const asset = await serve("/assets/index-abc.js");
    expect(await asset?.text()).toBe("code");
    expect(asset?.headers.get("cache-control")).toContain("immutable");
    const route = await serve("/lines");
    expect(await route?.text()).toBe("<html>page</html>");
    expect(route?.headers.get("cache-control")).toBe("no-cache");
    expect(await (await serve("/../../etc/passwd"))?.text()).toBe("<html>page</html>");
  });

  test("from files a binary carries, by their path under dist", async () => {
    const dist = built();
    const serve = dashboardAssets(
      fromEmbedded(
        new Map([
          ["/index.html", join(dist, "index.html")],
          ["/assets/index-abc.js", join(dist, "assets", "index-abc.js")],
        ]),
      ),
    );
    expect(await (await serve("/assets/index-abc.js"))?.text()).toBe("code");
    expect(await (await serve("/assets/missing.js"))?.text()).toBe("<html>page</html>");
  });

  test("nothing when no dashboard was built", async () => {
    expect(await dashboardAssets(fromEmbedded(new Map()))("/")).toBeNull();
  });
});
