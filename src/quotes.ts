// pattern: Functional Core
// Shape raw appview posts into review-grid rows, and reduce rows to a block target set.

import type { QuoteRow } from "./types.js";

/** The slice of app.bsky.feed.getQuotes#posts we care about. Unknown fields ignored. */
export interface RawPost {
  uri?: unknown;
  indexedAt?: unknown;
  author?: { did?: unknown; handle?: unknown; displayName?: unknown };
  record?: { text?: unknown };
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function toRows(posts: readonly RawPost[]): QuoteRow[] {
  const rows: QuoteRow[] = [];
  for (const p of posts) {
    const did = str(p.author?.did);
    if (did === "") continue; // a quoter with no DID can't be blocked; drop it
    rows.push({
      did,
      handle: str(p.author?.handle),
      displayName: str(p.author?.displayName),
      text: str(p.record?.text),
      uri: str(p.uri),
      indexedAt: str(p.indexedAt),
    });
  }
  return rows;
}

/**
 * One person can quote a post several times. For blocking we act per account, so
 * collapse to the first row seen per DID — preserving input order.
 */
export function dedupeByDid(rows: readonly QuoteRow[]): QuoteRow[] {
  const seen = new Set<string>();
  const out: QuoteRow[] = [];
  for (const r of rows) {
    if (seen.has(r.did)) continue;
    seen.add(r.did);
    out.push(r);
  }
  return out;
}
