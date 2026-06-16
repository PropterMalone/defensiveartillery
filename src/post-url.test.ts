import { describe, expect, it } from "vitest";
import { parsePostUrl, toPostAtUri } from "./post-url.js";

describe("parsePostUrl", () => {
  it("parses a full bsky.app profile/post URL with a DID author", () => {
    const r = parsePostUrl(
      "https://bsky.app/profile/did:plc:e6n7jxtu2qrhwvp3j6ib6sq6/post/3mogjhcw4ec2q",
    );
    expect(r).toEqual({
      ok: true,
      value: { author: "did:plc:e6n7jxtu2qrhwvp3j6ib6sq6", rkey: "3mogjhcw4ec2q" },
    });
  });

  it("parses a handle author", () => {
    const r = parsePostUrl("https://bsky.app/profile/peark.es/post/abc123");
    expect(r).toEqual({ ok: true, value: { author: "peark.es", rkey: "abc123" } });
  });

  it("tolerates a missing scheme", () => {
    const r = parsePostUrl("bsky.app/profile/peark.es/post/abc123");
    expect(r.ok && r.value.rkey).toBe("abc123");
  });

  it("parses an at-uri", () => {
    const r = parsePostUrl("at://did:plc:abc/app.bsky.feed.post/xyz");
    expect(r).toEqual({ ok: true, value: { author: "did:plc:abc", rkey: "xyz" } });
  });

  it("rejects an empty string", () => {
    expect(parsePostUrl("   ").ok).toBe(false);
  });

  it("rejects a non-post URL", () => {
    expect(parsePostUrl("https://bsky.app/profile/peark.es").ok).toBe(false);
  });

  it("rejects an at-uri for the wrong collection", () => {
    expect(parsePostUrl("at://did:plc:abc/app.bsky.feed.like/xyz").ok).toBe(false);
  });
});

describe("toPostAtUri", () => {
  it("builds a feed.post at-uri", () => {
    expect(toPostAtUri("did:plc:abc", "xyz")).toBe("at://did:plc:abc/app.bsky.feed.post/xyz");
  });
});
