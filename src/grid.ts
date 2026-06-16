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
  const body = rows
    .map((r, i) => `| ${i + 1} | @${r.handle} | ${truncate(r.text, 80).replace(/\|/g, "\\|")} |`)
    .join("\n");
  return `${header}\n${body}`;
}
