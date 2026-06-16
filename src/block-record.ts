// pattern: Functional Core
// Build the app.bsky.graph.block record. createdAt is injected so this stays pure/testable.

export interface BlockRecord {
  $type: "app.bsky.graph.block";
  subject: string;
  createdAt: string;
}

export function buildBlockRecord(subjectDid: string, createdAt: string): BlockRecord {
  return { $type: "app.bsky.graph.block", subject: subjectDid, createdAt };
}
