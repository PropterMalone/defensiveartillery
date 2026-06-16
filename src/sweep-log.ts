// pattern: Functional Core
// The sweep log records every applied block/mute so a sweep can be reviewed and reversed.
// One JSON object per line in sweeps.jsonl; entries of one `block --confirm` run share a sweepId.

export type SweepKind = "block" | "mute";

export interface SweepEntry {
  /** ISO timestamp identifying the run; all entries from one invocation share it. */
  sweepId: string;
  kind: SweepKind;
  did: string;
  /** The block record's at-uri (blocks only — mutes have no record). Enables direct deletion. */
  uri?: string;
}

export function formatSweepLine(entry: SweepEntry): string {
  return JSON.stringify(entry);
}

export function parseSweepLog(text: string): SweepEntry[] {
  const out: SweepEntry[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t === "") continue;
    let o: unknown;
    try {
      o = JSON.parse(t);
    } catch {
      continue; // skip malformed lines rather than failing the whole undo
    }
    const e = o as Partial<SweepEntry>;
    if (
      typeof e.sweepId === "string" &&
      typeof e.did === "string" &&
      (e.kind === "block" || e.kind === "mute")
    ) {
      out.push({
        sweepId: e.sweepId,
        kind: e.kind,
        did: e.did,
        uri: typeof e.uri === "string" ? e.uri : undefined,
      });
    }
  }
  return out;
}

/** The entries of the most recent sweep (max sweepId — ISO timestamps sort chronologically). */
export function lastSweep(entries: readonly SweepEntry[]): SweepEntry[] {
  let maxId = "";
  for (const e of entries) if (e.sweepId > maxId) maxId = e.sweepId;
  return maxId === "" ? [] : entries.filter((e) => e.sweepId === maxId);
}

/** Extract the rkey (last segment) from an `at://did/collection/rkey` uri. */
export function rkeyFromAtUri(uri: string): string | null {
  if (!uri.startsWith("at://")) return null;
  const parts = uri.slice("at://".length).split("/");
  if (parts.length !== 3 || !parts[2]) return null;
  return parts[2];
}
