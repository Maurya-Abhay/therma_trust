import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileUrl, verifyFileSignature } from "../src/lib/http.js";

describe("private evidence download links", () => {
  it("signs a single safe file path and rejects changed paths", () => {
    const url = new URL(fileUrl({ protocol: "https", get: () => "api.example.test" }, "credentials/card.pdf"));
    assert.equal(url.pathname, "/media/credentials/card.pdf");
    assert.equal(verifyFileSignature("credentials/card.pdf", url.searchParams.get("expires"), url.searchParams.get("sig")), true);
    assert.equal(verifyFileSignature("credentials/other.pdf", url.searchParams.get("expires"), url.searchParams.get("sig")), false);
  });

  it("rejects expired, malformed, and traversal paths", () => {
    const url = new URL(fileUrl({ protocol: "https", get: () => "api.example.test" }, "credentials/card.pdf"));
    assert.equal(verifyFileSignature("credentials/card.pdf", "1", url.searchParams.get("sig")), false);
    assert.equal(verifyFileSignature("credentials/card.pdf", "not-a-time", url.searchParams.get("sig")), false);
    assert.equal(fileUrl({ protocol: "https", get: () => "api.example.test" }, "../secrets.txt"), null);
    assert.equal(fileUrl({ protocol: "https", get: () => "api.example.test" }, "credentials/nested/card.pdf"), null);
  });
});
