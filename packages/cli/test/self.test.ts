import { describe, expect, test } from "bun:test";
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
