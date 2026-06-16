// pattern: Imperative Shell
// Entry point. Subcommands: `quotes <post-url>`, `block [--mute] [--confirm] <did…>`,
// `unblock [--mute] [--confirm] (--last | <did…>)`. Designed to be driven by Claude Code — see CLAUDE.md.

import { appendFileSync, readFileSync } from "node:fs";
import {
  DEFAULT_PDS,
  type Session,
  createBlock,
  createSession,
  deleteBlock,
  getAllQuotes,
  listBlocks,
  muteActor,
  resolveDid,
  unmuteActor,
} from "./atproto.js";
import { buildBlockRecord } from "./block-record.js";
import { parseDotEnv } from "./dotenv.js";
import { renderGrid } from "./grid.js";
import { parsePostUrl, toPostAtUri } from "./post-url.js";
import { dedupeByDid, toRows } from "./quotes.js";
import {
  type SweepEntry,
  type SweepKind,
  formatSweepLine,
  lastSweep,
  parseSweepLog,
  rkeyFromAtUri,
} from "./sweep-log.js";

/** Append-only audit log of applied block/mute actions; enables `unblock --last`. */
const SWEEP_LOG = "sweeps.jsonl";

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

/** Load .env, validate credentials + PDS, open an authenticated session. Dies on any failure. */
async function resolveSession(): Promise<Session> {
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
  return session.value;
}

function appendSweep(entry: SweepEntry): void {
  appendFileSync(SWEEP_LOG, `${formatSweepLine(entry)}\n`);
}

async function cmdBlock(args: string[]): Promise<void> {
  const mute = args.includes("--mute");
  const confirm = args.includes("--confirm");
  const verb = mute ? "mute" : "block";
  const kind: SweepKind = mute ? "mute" : "block";
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

  const session = await resolveSession();
  const sweepId = new Date().toISOString();
  process.stdout.write(`${verb === "block" ? "Blocking" : "Muting"} ${dids.length} account(s)…\n`);
  let okCount = 0;
  for (const did of dids) {
    if (mute) {
      const r = await muteActor(session, did);
      if (!r.ok) {
        process.stderr.write(`  ✗ ${did}: ${r.error}\n`);
        continue;
      }
      appendSweep({ sweepId, kind, did });
      process.stdout.write(`  ✓ muted ${did}\n`);
    } else {
      const r = await createBlock(session, buildBlockRecord(did, sweepId));
      if (!r.ok) {
        process.stderr.write(`  ✗ ${did}: ${r.error}\n`);
        continue;
      }
      appendSweep({ sweepId, kind, did, uri: r.value.uri });
      process.stdout.write(`  ✓ blocked ${did}\n`);
    }
    okCount++;
  }
  process.stdout.write(`\nDone: ${okCount}/${dids.length} ${verb}ed. Logged to ${SWEEP_LOG}.\n`);
  if (okCount < dids.length) process.exit(1);
}

async function cmdUnblock(args: string[]): Promise<void> {
  const mute = args.includes("--mute");
  const confirm = args.includes("--confirm");
  const last = args.includes("--last");

  // Build the target list: either the most recent sweep, or explicit DIDs.
  type Target = { did: string; kind: SweepKind; uri?: string };
  let targets: Target[];
  if (last) {
    let text = "";
    try {
      text = readFileSync(SWEEP_LOG, "utf8");
    } catch {
      die(`no sweep log at ${SWEEP_LOG} — nothing to undo`);
    }
    const entries = lastSweep(parseSweepLog(text));
    if (entries.length === 0) die(`${SWEEP_LOG} has no recorded sweeps — nothing to undo`);
    targets = entries.map((e) => ({ did: e.did, kind: e.kind, uri: e.uri }));
  } else {
    const kind: SweepKind = mute ? "mute" : "block";
    const dids = [...new Set(readDids(args))];
    if (dids.length === 0) {
      die(`usage: npm run unblock -- ${mute ? "--mute " : ""}[--confirm] <did…>  (or --last)`);
    }
    targets = dids.map((did) => ({ did, kind }));
  }

  if (!confirm) {
    process.stdout.write(
      `DRY RUN — would ${last ? "undo the last sweep:" : "reverse:"} ${targets.length} account(s):\n`,
    );
    for (const t of targets) {
      process.stdout.write(`  • ${t.kind === "mute" ? "unmute" : "unblock"} ${t.did}\n`);
    }
    process.stdout.write("\nRe-run with --confirm to apply.\n");
    return;
  }

  const session = await resolveSession();

  // Unblocking by DID needs the block record's rkey; look it up once if any target lacks a uri.
  let blockMap: Map<string, string> | null = null;
  if (targets.some((t) => t.kind === "block" && !t.uri)) {
    const lr = await listBlocks(session);
    if (!lr.ok) die(lr.error);
    blockMap = lr.value;
  }

  let okCount = 0;
  let failures = 0;
  for (const t of targets) {
    if (t.kind === "mute") {
      const r = await unmuteActor(session, t.did);
      if (!r.ok) {
        process.stderr.write(`  ✗ ${t.did}: ${r.error}\n`);
        failures++;
        continue;
      }
      process.stdout.write(`  ✓ unmuted ${t.did}\n`);
      okCount++;
      continue;
    }
    const rkey = t.uri ? rkeyFromAtUri(t.uri) : (blockMap?.get(t.did) ?? null);
    if (!rkey) {
      process.stdout.write(`  – ${t.did}: not currently blocked (skipped)\n`);
      continue;
    }
    const r = await deleteBlock(session, rkey);
    if (!r.ok) {
      process.stderr.write(`  ✗ ${t.did}: ${r.error}\n`);
      failures++;
      continue;
    }
    process.stdout.write(`  ✓ unblocked ${t.did}\n`);
    okCount++;
  }
  process.stdout.write(`\nDone: ${okCount} reversed, ${failures} failed.\n`);
  if (failures > 0) process.exit(1);
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
    case "unblock":
      await cmdUnblock(rest);
      break;
    default:
      die("usage: cli.ts <quotes|block|unblock> …");
  }
}

main().catch((e) => die((e as Error).message));
