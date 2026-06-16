// pattern: Imperative Shell
// Thin HTTP wrappers over the AT Protocol XRPC endpoints. The pure logic lives elsewhere;
// this module only does network I/O and returns Results for expected failures.

import type { BlockRecord } from "./block-record.js";
import type { RawPost } from "./quotes.js";
import { type Result, err, ok } from "./result.js";
import { rkeyFromAtUri } from "./sweep-log.js";

// Routing: public reads (resolveHandle, getQuotes) go to the unauthenticated APPVIEW;
// authenticated writes (createRecord, muteActor) go to the user's PDS (session.pds).
const APPVIEW = "https://public.api.bsky.app";
// Default assumes a bsky.social-hosted account (the entryway forwards writes to the real PDS).
// Self-hosted or PDS-migrated users must set BSKY_PDS to their actual PDS.
export const DEFAULT_PDS = "https://bsky.social";

export interface Session {
  did: string;
  accessJwt: string;
  pds: string;
}

async function xrpc(
  base: string,
  nsid: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<Result<unknown>> {
  const { query, ...rest } = init;
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  let res: Response;
  try {
    res = await fetch(`${base}/xrpc/${nsid}${qs}`, rest);
  } catch (e) {
    return err(`network error calling ${nsid}: ${(e as Error).message}`);
  }
  const body = await res.text();
  let json: unknown;
  try {
    json = body === "" ? {} : JSON.parse(body);
  } catch {
    return err(`${nsid} returned non-JSON (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg =
      (json as { message?: string; error?: string }).message ??
      (json as { error?: string }).error ??
      `HTTP ${res.status}`;
    return err(`${nsid} failed: ${msg}`);
  }
  return ok(json);
}

/** Resolve a handle (peark.es) to a DID. Pass-through if already a DID. */
export async function resolveDid(authorOrHandle: string): Promise<Result<string>> {
  if (authorOrHandle.startsWith("did:")) return ok(authorOrHandle);
  const r = await xrpc(APPVIEW, "com.atproto.identity.resolveHandle", {
    query: { handle: authorOrHandle },
  });
  if (!r.ok) return r;
  const did = (r.value as { did?: string }).did;
  return did ? ok(did) : err(`could not resolve handle: ${authorOrHandle}`);
}

export async function createSession(
  pds: string,
  identifier: string,
  appPassword: string,
): Promise<Result<Session>> {
  const r = await xrpc(pds, "com.atproto.server.createSession", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password: appPassword }),
  });
  if (!r.ok) return r;
  const { did, accessJwt } = r.value as { did?: string; accessJwt?: string };
  if (!did || !accessJwt) return err("createSession response missing did/accessJwt");
  return ok({ did, accessJwt, pds });
}

/** Page through every quote post of the subject. Public appview, no auth needed. */
export async function getAllQuotes(subjectAtUri: string): Promise<Result<RawPost[]>> {
  const all: RawPost[] = [];
  let cursor: string | undefined;
  // Bounded so a runaway cursor can't loop forever; 50 pages * 100 = 5000 quotes.
  const MAX_PAGES = 50;
  let page = 0;
  for (; page < MAX_PAGES; page++) {
    const query: Record<string, string> = { uri: subjectAtUri, limit: "100" };
    if (cursor) query.cursor = cursor;
    const r = await xrpc(APPVIEW, "app.bsky.feed.getQuotes", { query });
    if (!r.ok) return r;
    const data = r.value as { posts?: RawPost[]; cursor?: string };
    if (Array.isArray(data.posts)) all.push(...data.posts);
    cursor = data.cursor;
    // AT Proto signals end-of-feed by omitting the cursor. An empty page that still
    // carries a cursor is not the end — break only when the cursor is gone.
    if (!cursor) break;
  }
  if (cursor && page === MAX_PAGES) {
    process.stderr.write(
      `warning: stopped at the ${MAX_PAGES * 100}-quote cap; more quotes exist but were not fetched\n`,
    );
  }
  return ok(all);
}

export async function createBlock(
  session: Session,
  record: BlockRecord,
): Promise<Result<{ uri: string }>> {
  const r = await xrpc(session.pds, "com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.graph.block",
      record,
    }),
  });
  if (!r.ok) return r;
  const uri = (r.value as { uri?: string }).uri;
  return uri ? ok({ uri }) : err("createRecord response missing uri");
}

export async function muteActor(session: Session, did: string): Promise<Result<true>> {
  const r = await xrpc(session.pds, "app.bsky.graph.muteActor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({ actor: did }),
  });
  return r.ok ? ok(true) : r;
}

export async function unmuteActor(session: Session, did: string): Promise<Result<true>> {
  const r = await xrpc(session.pds, "app.bsky.graph.unmuteActor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({ actor: did }),
  });
  return r.ok ? ok(true) : r;
}

/** Delete a block record by its rkey (the reverse of createBlock). */
export async function deleteBlock(session: Session, rkey: string): Promise<Result<true>> {
  const r = await xrpc(session.pds, "com.atproto.repo.deleteRecord", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.graph.block",
      rkey,
    }),
  });
  return r.ok ? ok(true) : r;
}

/**
 * List the user's existing block records as a subject-DID → rkey map. Used to unblock by DID
 * when the block record's uri isn't known from the sweep log. Keeps the first rkey per subject.
 */
export async function listBlocks(session: Session): Promise<Result<Map<string, string>>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const query: Record<string, string> = {
      repo: session.did,
      collection: "app.bsky.graph.block",
      limit: "100",
    };
    if (cursor) query.cursor = cursor;
    const r = await xrpc(session.pds, "com.atproto.repo.listRecords", {
      query,
      headers: { authorization: `Bearer ${session.accessJwt}` },
    });
    if (!r.ok) return r;
    const data = r.value as {
      records?: { uri?: string; value?: { subject?: string } }[];
      cursor?: string;
    };
    for (const rec of data.records ?? []) {
      const subject = rec.value?.subject;
      const rkey = rec.uri ? rkeyFromAtUri(rec.uri) : null;
      if (typeof subject === "string" && rkey && !map.has(subject)) map.set(subject, rkey);
    }
    cursor = data.cursor;
    if (!cursor) break;
  }
  return ok(map);
}
