// pattern: Functional Core
// Parse the various ways a Bluesky post gets referenced into {author, rkey}.

import { type Result, err, ok } from "./result.js";
import type { PostRef } from "./types.js";

const FEED_POST = "app.bsky.feed.post";

/**
 * Accepts:
 *   https://bsky.app/profile/<didOrHandle>/post/<rkey>
 *   bsky.app/profile/<didOrHandle>/post/<rkey>   (no scheme)
 *   at://<did>/app.bsky.feed.post/<rkey>
 */
export function parsePostUrl(input: string): Result<PostRef> {
  const raw = input.trim();
  if (raw === "") return err("empty post reference");

  if (raw.startsWith("at://")) {
    const rest = raw.slice("at://".length);
    const parts = rest.split("/");
    if (parts.length !== 3 || parts[1] !== FEED_POST || !parts[0] || !parts[2]) {
      return err(`not a valid post at-uri: ${input}`);
    }
    return ok({ author: parts[0], rkey: parts[2] });
  }

  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return err(`could not parse as a URL: ${input}`);
  }

  // Expect path /profile/<author>/post/<rkey>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 4 || segments[0] !== "profile" || segments[2] !== "post") {
    return err(`not a bsky.app post URL (expected /profile/<author>/post/<rkey>): ${input}`);
  }
  const author = segments[1];
  const rkey = segments[3];
  if (!author || !rkey) return err(`missing author or rkey in: ${input}`);
  return ok({ author, rkey });
}

/** Build the subject at-uri once the author DID is known. */
export function toPostAtUri(authorDid: string, rkey: string): string {
  return `at://${authorDid}/${FEED_POST}/${rkey}`;
}
