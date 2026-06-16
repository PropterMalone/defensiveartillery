// pattern: Imperative Shell
// Entry point. Two subcommands: `quotes <post-url>` and `block [--mute] [--confirm] <did…>`.
// Designed to be driven by Claude Code — see CLAUDE.md.

import { readFileSync } from "node:fs";
import {
  DEFAULT_PDS,
  type Session,
  createBlock,
  createSession,
  getAllQuotes,
  muteActor,
  resolveDid,
} from "./atproto.js";
import { buildBlockRecord } from "./block-record.js";
import { parseDotEnv } from "./dotenv.js";
import { renderGrid } from "./grid.js";
import { parsePostUrl, toPostAtUri } from "./post-url.js";
import { dedupeByDid, toRows } from "./quotes.js";

function die(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

/** Minimal .env loader — no dependency. Does not override already-set env vars. */
function loadDotEnv(): void {
  let text: string;
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return;
  }
  // Parsing is pure (dotenv.ts); here we only apply, without overriding already-set vars.
  for (const [key, value] of Object.entries(parseDotEnv(text))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function cmdQuotes(args: string[]): Promise<void> {
  const asGrid = args.includes("--grid");
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) die("usage: npm run quotes -- <post-url> [--grid]");

  const parsed = parsePostUrl(url);
  if (!parsed.ok) die(parsed.error);

  const did = await resolveDid(parsed.value.author);
  if (!did.ok) die(did.error);

  const subject = toPostAtUri(did.value, parsed.value.rkey);
  const quotes = await getAllQuotes(subject);
  if (!quotes.ok) die(quotes.error);

  const rows = dedupeByDid(toRows(quotes.value));
  process.stderr.write(`Found ${rows.length} unique quoter(s) of ${subject}\n`);

  if (asGrid) {
    process.stdout.write(`${renderGrid(rows)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({ subject, count: rows.length, rows }, null, 2)}\n`);
}

function readDids(args: string[]): string[] {
  const fromArgs = args.filter((a) => a.startsWith("did:"));
  if (fromArgs.length > 0) return fromArgs;
  // Fall back to whitespace-separated DIDs on stdin (supports piping).
  let stdin = "";
  try {
    stdin = readFileSync(0, "utf8");
  } catch {
    stdin = "";
  }
  return stdin.split(/\s+/).filter((t) => t.startsWith("did:"));
}

async function applyAction(
  session: Session,
  did: string,
  mute: boolean,
  createdAt: string,
): Promise<boolean> {
  const r = mute
    ? await muteActor(session, did)
    : await createBlock(session, buildBlockRecord(did, createdAt));
  if (!r.ok) {
    process.stderr.write(`  ✗ ${did}: ${r.error}\n`);
    return false;
  }
  process.stdout.write(`  ✓ ${mute ? "muted" : "blocked"} ${did}\n`);
  return true;
}

async function cmdBlock(args: string[]): Promise<void> {
  const mute = args.includes("--mute");
  const confirm = args.includes("--confirm");
  const verb = mute ? "mute" : "block";
  const dids = [...new Set(readDids(args))];
  if (dids.length === 0) {
    die(
      `usage: npm run ${mute ? "block -- --mute" : "block --"} [--confirm] <did…> (or pipe DIDs)`,
    );
  }

  if (!confirm) {
    process.stdout.write(`DRY RUN — would ${verb} ${dids.length} account(s):\n`);
    for (const d of dids) process.stdout.write(`  • ${d}\n`);
    process.stdout.write("\nRe-run with --confirm to apply.\n");
    return;
  }

  loadDotEnv();
  const handle = process.env.BSKY_HANDLE;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!handle || !password) {
    die("BSKY_HANDLE and BSKY_APP_PASSWORD must be set (copy .env.example to .env)");
  }
  const pds = process.env.BSKY_PDS || DEFAULT_PDS;
  if (!pds.startsWith("https://")) {
    die(
      `BSKY_PDS must be an https:// URL (got: ${pds}); refusing to send credentials over a non-HTTPS host`,
    );
  }

  const session = await createSession(pds, handle, password);
  if (!session.ok) {
    die(
      `${session.error}\n(if your account was PDS-migrated or self-hosted, set BSKY_PDS in .env to your PDS URL)`,
    );
  }

  const createdAt = new Date().toISOString();
  process.stdout.write(`${verb === "block" ? "Blocking" : "Muting"} ${dids.length} account(s)…\n`);
  let okCount = 0;
  for (const did of dids) {
    if (await applyAction(session.value, did, mute, createdAt)) okCount++;
  }
  process.stdout.write(`\nDone: ${okCount}/${dids.length} ${verb}ed.\n`);
  if (okCount < dids.length) process.exit(1);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "quotes":
      await cmdQuotes(rest);
      break;
    case "block":
      await cmdBlock(rest);
      break;
    default:
      die("usage: cli.ts <quotes|block> …");
  }
}

main().catch((e) => die((e as Error).message));
