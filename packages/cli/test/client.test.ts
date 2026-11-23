import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";

const CLIENT = join(import.meta.dir, "../src/client.ts");

/** A server from another build: every answer names a build this octo is not. */
const server = Bun.serve({
  port: 0,
  fetch: () =>
    Response.json({ ok: true, cursor: 0, pid: null }, { headers: { "x-octo-build": "another-build" } }),
});
afterAll(() => server.stop(true));

/** Asks the server for its health from a fresh process, and returns what that process wrote on stderr. */
async function stderrOfAsking(silenced: boolean): Promise<string> {
  const script = [
    `import { OctoClient } from ${JSON.stringify(CLIENT)};`,
    `const client = new OctoClient(${JSON.stringify(server.url.origin)}, null, [], false);`,
    silenced ? "client.silenceBuildWarning();" : "",
    `await client.get("/api/health");`,
  ].join("\n");
  const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
  const [stderr] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  return stderr;
}

describe("the warning that the server is from another build", () => {
  test("is given when an octo reaches a server from another build", async () => {
    expect(await stderrOfAsking(false)).toContain("the server runs build another-build");
  });

  test("is not given by the client installing or rolling back, which is the one replacing that server", async () => {
    expect(await stderrOfAsking(true)).toBe("");
  });
});
