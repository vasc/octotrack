import { describe, expect, test } from "bun:test";
import { serverEnvironment } from "../src/client.ts";
import { selfCommand } from "../src/self.ts";

describe("running octo again", () => {
  test("a script runs under bun, by its path", () => {
    expect(selfCommand("/repo/packages/cli/src/main.ts", "/usr/local/bin/bun")).toEqual([
      "/usr/local/bin/bun",
      "/repo/packages/cli/src/main.ts",
    ]);
  });

  test("a compiled binary is its own program, whose script path is virtual", () => {
    expect(selfCommand("/$bunfs/root/octo", "/Users/me/.octotrack/bin/octo")).toEqual([
      "/Users/me/.octotrack/bin/octo",
    ]);
    expect(selfCommand("B:/~BUN/root/octo.exe", "C:\\octo.exe")).toEqual(["C:\\octo.exe"]);
  });
});

describe("the server a command starts", () => {
  test("never carries the name of the agent that happened to start it, nor the developer's presence", () => {
    expect(
      serverEnvironment({ PATH: "/bin", OCTO_HOME: "/tmp/octo", OCTO_AGENT: "panel", OCTO_DEVELOPER: "1" }),
    ).toEqual({ PATH: "/bin", OCTO_HOME: "/tmp/octo" });
  });
});
