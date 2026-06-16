// pattern: Functional Core
// Parse .env text into key/value pairs. Pure — the filesystem read and process.env
// application live in the shell (cli.ts loadDotEnv).

export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key === "") continue;
    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // Unquoted values: an inline " # comment" is not part of the value (dotenv convention).
      // Without this, `KEY=secret # note` silently stores "secret # note" and auth fails.
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }
    out[key] = value;
  }
  return out;
}
