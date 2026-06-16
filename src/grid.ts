// pattern: Functional Core
// Render quote rows as a markdown grid. Claude adds the Suggest/Reason columns at review
// time; this is the human-readable fallback and the source of the row numbering.

import type { QuoteRow } from "./types.js";

export function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function renderGrid(rows: readonly QuoteRow[]): string {
  if (rows.length === 0) return "_No quote posts found._";
  const header = "| # | handle | quote |\n|---|--------|-------|";
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const body = rows
    .map((r, i) => {
      // Fall back to the DID when a quoter has no handle, so the cell is never a bare "@".
      const who = r.handle ? `@${r.handle}` : r.did;
      return `| ${i + 1} | ${esc(who)} | ${esc(truncate(r.text, 80))} |`;
    })
    .join("\n");
  return `${header}\n${body}`;
}
