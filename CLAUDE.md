# Defensive Artillery — drive instructions for Claude Code

You are helping the user clean up the quote-posts under a Bluesky post: surface everyone
who quoted it, suggest which ones are insulting/harassing/bad-faith, and bulk block (or mute)
the ones the user confirms. The user judges; you assist. **Never block or mute anyone without
the user's explicit confirmation in this conversation.**

## The workflow

When the user gives you a Bluesky post URL and asks to sweep its quotes:

1. **Check auth is set up.** If `.env` does not exist, tell the user to copy `.env.example` to
   `.env` and fill in `BSKY_HANDLE` and a Bluesky **app password**
   (https://bsky.app/settings/app-passwords — not their main password). The `quotes` step
   needs no auth; only the `block`/`mute` step does, so you can fetch quotes first regardless.

2. **Fetch the quotes:**
   ```
   npm run quotes -- "<post-url>"
   ```
   This prints JSON: `{ subject, count, rows[] }`. Each row has `did`, `handle`, `displayName`,
   `text`, `uri`. (Add `--grid` for a plain markdown table instead of JSON.)

3. **Render a review grid with your suggestions.** Read every quote's `text` and build a table:

   | # | handle | quote (excerpt) | suggest | why |
   |---|--------|-----------------|---------|-----|
   | 1 | @… | … | **BLOCK** | direct insult / slur / harassment |
   | 2 | @… | … | skip | good-faith disagreement |

   **Suggestion bar — be conservative.** The user's own rule of thumb: good-faith disagreement
   is fine and should be `skip`. Suggest **BLOCK** only for clear insults, slurs, harassment,
   dogpiling, or plainly bad-faith nonsense directed at the user or the post. When unsure, `skip`
   and say so. You are pre-filtering to save clicks, not autoblocking — over-blocking is the
   failure mode to avoid.

4. **Confirm before acting.** Present the grid, state how many you're suggesting to block, and
   ask the user to confirm or adjust (e.g. "drop 3 and 7, add 12"). Wait for their answer.

5. **Apply.** Once confirmed, collect the chosen DIDs and run:
   ```
   npm run block -- --confirm <did1> <did2> <did3> …
   ```
   - Add `--mute` (`npm run block -- --mute --confirm <did…>`) if the user wants to mute instead
     of block. Mute is softer and reversible-without-trace; block is public and stronger.
   - **Without `--confirm` the command is a dry run** — it lists who it would block and applies
     nothing. Use a dry run first if you want the user to eyeball the final DID list.

## Notes

- Blocks created here are **permanent** AT Protocol blocks (the same as blocking in the app).
  There is no auto-expiration — for temporary blocks, the user wants ErgoBlock instead.
- Quotes come from the public appview, so a quote that's already detached or from an account
  that blocks the subject may not appear. The count is "what's publicly visible now."
- Blocking is per-account and de-duplicated automatically, so passing the same DID twice is safe.
- If the user just says "block the obvious ones," still show the grid and your picks first —
  one confirmation, then fire.
