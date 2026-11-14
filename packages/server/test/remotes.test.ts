import { describe, expect, test } from "bun:test";
import { cachedRemoteOf, githubSlug } from "../src/remotes.ts";

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
