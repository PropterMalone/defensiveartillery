import { describe, expect, it } from "vitest";
import { parseDotEnv } from "./dotenv.js";

describe("parseDotEnv", () => {
  it("parses simple key=value pairs", () => {
    expect(parseDotEnv("BSKY_HANDLE=peark.es\nBSKY_APP_PASSWORD=abcd-efgh")).toEqual({
      BSKY_HANDLE: "peark.es",
      BSKY_APP_PASSWORD: "abcd-efgh",
    });
  });

  it("skips blank lines and full-line comments", () => {
    expect(parseDotEnv("# a comment\n\nBSKY_HANDLE=x\n")).toEqual({ BSKY_HANDLE: "x" });
  });

  it("strips an inline comment from an unquoted value", () => {
    // The bug this guards: without stripping, the password silently includes "# note".
    expect(parseDotEnv("BSKY_APP_PASSWORD=abcd-efgh # generated 2026").BSKY_APP_PASSWORD).toBe(
      "abcd-efgh",
    );
  });

  it("keeps a # inside a quoted value", () => {
    expect(parseDotEnv('BSKY_APP_PASSWORD="ab#cd"').BSKY_APP_PASSWORD).toBe("ab#cd");
  });

  it("strips matching surrounding quotes", () => {
    expect(parseDotEnv("A='single'\nB=\"double\"")).toEqual({ A: "single", B: "double" });
  });

  it("ignores lines with no =", () => {
    expect(parseDotEnv("NOPE\nA=1")).toEqual({ A: "1" });
  });

  it("preserves = inside the value", () => {
    expect(parseDotEnv("URL=https://x/?a=b").URL).toBe("https://x/?a=b");
  });
});
