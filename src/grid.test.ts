import { describe, expect, it } from "vitest";
import { renderGrid, truncate } from "./grid.js";
import type { QuoteRow } from "./types.js";

const row = (handle: string, text: string): QuoteRow => ({
  handle,
  displayName: handle,
  did: `did:plc:${handle}`,
  text,
  uri: `at://did:plc:${handle}/app.bsky.feed.post/x`,
  indexedAt: "2026-06-16T00:00:00Z",
});

describe("truncate", () => {
  it("collapses whitespace and leaves short text intact", () => {
    expect(truncate("hello   world", 80)).toBe("hello world");
  });
  it("adds an ellipsis past the limit", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
  it("leaves a string at exactly the limit untouched", () => {
    expect(truncate("abcde", 5)).toBe("abcde");
  });
});

describe("renderGrid", () => {
  it("notes when there are no quotes", () => {
    expect(renderGrid([])).toContain("No quote posts");
  });

  it("numbers rows from 1 and escapes pipes in quote text", () => {
    const md = renderGrid([row("a.test", "x | y"), row("b.test", "z")]);
    expect(md).toContain("| 1 | @a.test | x \\| y |");
    expect(md).toContain("| 2 | @b.test | z |");
  });

  it("falls back to the DID when a quoter has no handle", () => {
    const noHandle = { ...row("", "rude"), did: "did:plc:nohandle" };
    const md = renderGrid([noHandle]);
    expect(md).toContain("| 1 | did:plc:nohandle | rude |");
    expect(md).not.toContain("@ ");
  });
});
