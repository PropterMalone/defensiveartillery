import { describe, expect, it } from "vitest";
import { buildBlockRecord } from "./block-record.js";

describe("buildBlockRecord", () => {
  it("builds a graph.block record with the injected timestamp", () => {
    expect(buildBlockRecord("did:plc:a", "2026-06-16T12:00:00Z")).toEqual({
      $type: "app.bsky.graph.block",
      subject: "did:plc:a",
      createdAt: "2026-06-16T12:00:00Z",
    });
  });
});
