import { describe, expect, it } from "vitest";
import { type RawPost, dedupeByDid, toRows } from "./quotes.js";

const post = (did: string, text: string, handle = `${did}.test`): RawPost => ({
  uri: `at://${did}/app.bsky.feed.post/x`,
  indexedAt: "2026-06-16T00:00:00Z",
  author: { did, handle, displayName: handle },
  record: { text },
});

describe("toRows", () => {
  it("maps raw posts to grid rows", () => {
    const rows = toRows([post("did:plc:a", "rude thing")]);
    expect(rows).toEqual([
      {
        did: "did:plc:a",
        handle: "did:plc:a.test",
        displayName: "did:plc:a.test",
        text: "rude thing",
        uri: "at://did:plc:a/app.bsky.feed.post/x",
        indexedAt: "2026-06-16T00:00:00Z",
      },
    ]);
  });

  it("drops a post with no author DID", () => {
    expect(toRows([{ author: {}, record: { text: "x" } }])).toHaveLength(0);
  });

  it("coerces missing fields to empty strings", () => {
    const rows = toRows([{ author: { did: "did:plc:a" } }]);
    expect(rows[0]).toMatchObject({ did: "did:plc:a", text: "", handle: "" });
  });
});

describe("dedupeByDid", () => {
  it("keeps the first row per DID in order", () => {
    const rows = toRows([
      post("did:plc:a", "first"),
      post("did:plc:b", "other"),
      post("did:plc:a", "second from same person"),
    ]);
    const deduped = dedupeByDid(rows);
    expect(deduped.map((r) => r.did)).toEqual(["did:plc:a", "did:plc:b"]);
    expect(deduped[0]?.text).toBe("first");
  });
});
