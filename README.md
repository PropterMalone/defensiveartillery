# Defensive Artillery

Block (or mute) the people quote-posting a Bluesky post in bad faith — driven through
[Claude Code](https://claude.com/claude-code).

When a controversy flares on Bluesky, the quote-posts under it are often a target-rich pile of
insults and dogpiling. Walking them by hand and blocking the rude ones works but is tedious
(scroll → open profile → block → repeat). Defensive Artillery pulls every quoter into a grid, lets
Claude pre-flag the insulting ones, and blocks the set you confirm — in one pass.

## How it works

Three commands. Claude Code orchestrates them (see [`CLAUDE.md`](./CLAUDE.md)):

1. `npm run quotes -- <post-url>` — fetches every quote post (public, no login) and prints the
   list of quoters.
2. `npm run block -- --confirm <did…>` — blocks those accounts via your authenticated session.
   `--mute` mutes instead. Without `--confirm` it's a dry run. Every applied action is recorded
   to a local `sweeps.jsonl` (gitignored) so a sweep can be reviewed and undone.
3. `npm run unblock -- --last --confirm` — reverses the most recent sweep (unblocks blocks,
   unmutes mutes). Or `npm run unblock -- --confirm <did…>` to lift specific accounts.

The judging — *which* quotes are actually insults vs. fair disagreement — is done by Claude
reading the quotes and proposing a selection you approve. Nothing is blocked without your say-so.

## Setup

```bash
npm install
cp .env.example .env
```

Then edit `.env`:

- `BSKY_HANDLE` — your handle, e.g. `peark.es`
- `BSKY_APP_PASSWORD` — create one at https://bsky.app/settings/app-passwords
  (an **app password**, not your account password)
- `BSKY_PDS` — leave blank unless you self-host / use a non-`bsky.social` PDS

`.env` is gitignored. The `quotes` step needs no credentials; only blocking/muting does.

## Usage

Open Claude Code in this folder and just say what you want:

> Sweep the quotes of https://bsky.app/profile/…/post/… and block the ones being abusive.

Claude will fetch the quotes, show a grid with its suggested blocks (and why), and ask you to
confirm before it blocks anything.

### Manual / direct

```bash
# See who quoted a post (JSON), or --grid for a table
npm run quotes -- "https://bsky.app/profile/<handle-or-did>/post/<rkey>"
npm run quotes -- "<post-url>" --grid

# Dry run (lists, applies nothing)
npm run block -- did:plc:aaa did:plc:bbb

# Apply — block, or mute
npm run block -- --confirm did:plc:aaa did:plc:bbb
npm run block -- --mute --confirm did:plc:aaa did:plc:bbb

# Pipe DIDs from somewhere else
echo "did:plc:aaa did:plc:bbb" | npm run block -- --confirm

# Undo — reverse the whole last sweep, or lift specific accounts
npm run unblock -- --last                       # dry run: shows what it'd undo
npm run unblock -- --last --confirm             # unblock/unmute the last sweep
npm run unblock -- --confirm did:plc:aaa        # lift one account
npm run unblock -- --mute --confirm did:plc:aaa # unmute one account
```

## Notes & limits

- Blocks are **permanent** AT Protocol blocks — same as blocking in the app, no auto-expiry.
  For *temporary* blocking with auto-expiration, use [ErgoBlock](https://github.com/PropterMalone/ergoblock).
- Each applied block/mute is appended to `sweeps.jsonl` (gitignored), grouped per run. `unblock
  --last` reverses the most recent run. `unblock <did…>` works even for blocks not in the log —
  it looks up the block record on your account. There is no record of the source post in the log,
  only the accounts acted on.
- Quotes come from the public appview, so already-detached quotes or quotes from accounts that
  block you may not show up.
- Requires Node ≥ 22 (uses native `fetch`). No runtime dependencies.

## Development

```bash
npm run validate   # biome + tsc + vitest
```

Source is split Functional Core / Imperative Shell — pure logic (`post-url`, `quotes`, `grid`,
`block-record`) is unit-tested; the shell (`atproto`, `cli`) does I/O.
