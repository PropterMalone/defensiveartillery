import { describe, expect, it } from "vitest";
import {
  type SweepEntry,
  formatSweepLine,
  lastSweep,
  parseSweepLog,
  rkeyFromAtUri,
} from "./sweep-log.js";

const entry = (over: Partial<SweepEntry>): SweepEntry => ({
  sweepId: "2026-06-16T00:00:00.000Z",
  kind: "block",
  did: "did:plc:a",
  ...over,
});

describe("formatSweepLine / parseSweepLog round-trip", () => {
  it("round-trips a block entry with a uri", () => {
    const e = entry({ uri: "at://did:plc:me/app.bsky.graph.block/rk1" });
    expect(parseSweepLog(formatSweepLine(e))).toEqual([e]);
  });

  it("round-trips a mute entry with no uri", () => {
    const e = entry({ kind: "mute", uri: undefined });
    expect(parseSweepLog(formatSweepLine(e))).toEqual([e]);
  });

  it("skips blank and malformed lines", () => {
    const text = `${formatSweepLine(entry({}))}\n\nnot json\n{"incomplete":true}\n`;
    expect(parseSweepLog(text)).toHaveLength(1);
  });
});

describe("lastSweep", () => {
  it("returns only the entries of the most recent sweepId", () => {
    const entries = [
      entry({ sweepId: "2026-06-15T00:00:00.000Z", did: "did:plc:old" }),
      entry({ sweepId: "2026-06-16T12:00:00.000Z", did: "did:plc:a" }),
      entry({ sweepId: "2026-06-16T12:00:00.000Z", did: "did:plc:b" }),
    ];
    expect(lastSweep(entries).map((e) => e.did)).toEqual(["did:plc:a", "did:plc:b"]);
  });

  it("returns empty for no entries", () => {
    expect(lastSweep([])).toEqual([]);
  });
});

describe("rkeyFromAtUri", () => {
  it("extracts the rkey", () => {
    expect(rkeyFromAtUri("at://did:plc:me/app.bsky.graph.block/3kabc")).toBe("3kabc");
  });
  it("rejects non-at uris and malformed shapes", () => {
    expect(rkeyFromAtUri("https://example.com/x")).toBeNull();
    expect(rkeyFromAtUri("at://did:plc:me/app.bsky.graph.block")).toBeNull();
    expect(rkeyFromAtUri("at://did:plc:me/app.bsky.graph.block/")).toBeNull();
  });
});
