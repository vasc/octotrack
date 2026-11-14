import { describe, expect, test } from "bun:test";
import { skewWarning } from "../src/skew.ts";

describe("a CLI talking to a server from another build", () => {
  test("says so once, with what to do", () => {
    expect(skewWarning("abc", "abc")).toBeNull();
    expect(skewWarning("abc", null)).toBeNull();
    expect(skewWarning("abc", "def")).toContain("octo server stop");
  });

  test("a development checkout talking to its own development server is not skew", () => {
    expect(skewWarning("dev", "dev")).toBeNull();
  });
});
