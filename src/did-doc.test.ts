import { describe, expect, it } from "vitest";
import { pdsEndpointFromDidDoc } from "./did-doc.js";

describe("pdsEndpointFromDidDoc", () => {
  it("extracts the #atproto_pds service endpoint", () => {
    const didDoc = {
      service: [
        {
          id: "#atproto_pds",
          type: "AtprotoPersonalDataServer",
          serviceEndpoint: "https://pds.example.com",
        },
      ],
    };
    expect(pdsEndpointFromDidDoc(didDoc)).toBe("https://pds.example.com");
  });

  it("matches by type when the id differs", () => {
    const didDoc = {
      service: [
        { id: "#other", type: "AtprotoPersonalDataServer", serviceEndpoint: "https://pds.x" },
      ],
    };
    expect(pdsEndpointFromDidDoc(didDoc)).toBe("https://pds.x");
  });

  it("ignores non-https endpoints", () => {
    const didDoc = {
      service: [{ id: "#atproto_pds", serviceEndpoint: "http://insecure.example.com" }],
    };
    expect(pdsEndpointFromDidDoc(didDoc)).toBeNull();
  });

  it("returns null for missing/garbage didDocs", () => {
    expect(pdsEndpointFromDidDoc(undefined)).toBeNull();
    expect(pdsEndpointFromDidDoc({})).toBeNull();
    expect(pdsEndpointFromDidDoc({ service: "nope" })).toBeNull();
    expect(pdsEndpointFromDidDoc({ service: [] })).toBeNull();
  });
});
