import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { cachedRemoteOf, gitRemote, githubSlug } from "../src/remotes.ts";

describe("where a checkout's remote points", () => {
  test("reads GitHub remotes over https and ssh, with or without .git", () => {
    expect(githubSlug("https://github.com/vasc/homepanel.git\n")).toBe("vasc/homepanel");
    expect(githubSlug("git@github.com:vasc/homepanel.git")).toBe("vasc/homepanel");
    expect(githubSlug("https://github.com/vasc/homepanel")).toBe("vasc/homepanel");
    expect(githubSlug("https://gitlab.com/vasc/homepanel.git")).toBeNull();
  });

  test("asks git once per checkout", () => {
    const asked: string[] = [];
    const remoteOf = cachedRemoteOf((checkout) => {
      asked.push(checkout);
      return checkout === "/src/panel" ? "git@github.com:vasc/homepanel.git" : null;
    });
    expect(remoteOf("/src/panel")).toBe("vasc/homepanel");
    expect(remoteOf("/src/panel")).toBe("vasc/homepanel");
    expect(remoteOf("/src/elsewhere")).toBeNull();
    expect(asked).toEqual(["/src/panel", "/src/elsewhere"]);
  });
});

describe("reading a checkout's remote, from a path an agent's header names (third audit, N22)", () => {
  test("runs git only on an absolute path to a folder that exists", () => {
    expect(gitRemote("relative/path")).toBeNull();
    expect(gitRemote("/no/such/folder/for/octotrack")).toBeNull();
    expect(gitRemote("-c")).toBeNull();
  });

  test("a git that does not answer is given up on", () => {
    const begun = Date.now();
    expect(gitRemote(tmpdir(), ["sleep", "5"], 200)).toBeNull();
    expect(Date.now() - begun).toBeLessThan(3000);
  });

  test("remembers only so many checkouts, so a stream of made-up ones cannot fill memory", () => {
    let asked = 0;
    const remoteOf = cachedRemoteOf(() => {
      asked += 1;
      return null;
    }, 2);
    for (const path of ["/a", "/b", "/c", "/a"]) remoteOf(path);
    expect(asked).toBe(4);
  });
});
