// pattern: Functional Core
// Extract the user's real PDS endpoint from the DID document returned by createSession.
// createSession is called against the auth host (e.g. bsky.social entryway); the didDoc names
// the account's actual PDS, which is where writes should go — required for PDS-migrated users.

interface DidDocService {
  id?: unknown;
  type?: unknown;
  serviceEndpoint?: unknown;
}

export function pdsEndpointFromDidDoc(didDoc: unknown): string | null {
  const services = (didDoc as { service?: unknown } | null)?.service;
  if (!Array.isArray(services)) return null;
  for (const s of services as DidDocService[]) {
    const isPds =
      (typeof s?.id === "string" && s.id.endsWith("#atproto_pds")) ||
      s?.type === "AtprotoPersonalDataServer";
    if (
      isPds &&
      typeof s.serviceEndpoint === "string" &&
      s.serviceEndpoint.startsWith("https://")
    ) {
      return s.serviceEndpoint;
    }
  }
  return null;
}
