// pattern: Functional Core
// Shared shapes. One quoter = one row in the review grid.

export interface PostRef {
  /** A DID (did:plc:…) or a handle (peark.es). Resolve to a DID before building an at-uri. */
  author: string;
  /** The post record key, the last path segment. */
  rkey: string;
}

export interface QuoteRow {
  handle: string;
  displayName: string;
  did: string;
  text: string;
  /** at-uri of the quote post itself. */
  uri: string;
  indexedAt: string;
}
