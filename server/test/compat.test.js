import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./helpers.js";
import { computeEntryHash } from "../src/services/audit.js";
import { computeDigest } from "../src/services/passport.js";
import { pyJsonDumps } from "../src/lib/pyjson.js";
import { pythonIso } from "../src/lib/dates.js";
import { hashPassword, needsRehash, verifyPassword } from "../src/lib/security.js";

// Every expected value below was produced by the Django backend this replaces,
// so these tests fail if anything the old data depends on drifts.
describe("compatibility with the previous backend", () => {
  it("verifies a Django PBKDF2 password hash", async () => {
    const stored = "pbkdf2_sha256$1000000$fixedsalt01$654eDLZxr0aYauXCf+mCmOQVKP9hEKhIsy6h0g4OfhQ=";
    assert.equal(await verifyPassword("Secret123!", stored), true);
    assert.equal(await verifyPassword("secret123!", stored), false);
    assert.equal(needsRehash(stored), true);
  });

  it("verifies bcrypt hashes it creates itself", async () => {
    const stored = await hashPassword("Another-Pass-1");
    assert.equal(await verifyPassword("Another-Pass-1", stored), true);
    assert.equal(await verifyPassword("nope", stored), false);
    assert.equal(needsRehash(stored), false);
  });

  it("refuses unusable and empty stored passwords", async () => {
    assert.equal(await verifyPassword("anything", ""), false);
    assert.equal(await verifyPassword("anything", "!unusableTokenHere"), false);
  });

  it("serialises JSON exactly as Python's json.dumps(sort_keys=True)", () => {
    const meta = { technician_id: 7, override_warning: true, override_reason: "Café – urgent", kg: "12.50", n: null };
    assert.equal(
      pyJsonDumps(meta),
      '{"kg": "12.50", "n": null, "override_reason": "Caf\\u00e9 \\u2013 urgent", "override_warning": true, "technician_id": 7}'
    );
  });

  it("formats timestamps as Python's isoformat()", () => {
    assert.equal(pythonIso(new Date("2026-10-12T19:10:00.123Z")), "2026-10-12T19:10:00.123000+00:00");
    assert.equal(pythonIso(new Date("2026-10-12T19:11:05Z")), "2026-10-12T19:11:05+00:00");
  });

  it("computes the same audit entry hashes, so an imported chain keeps verifying", () => {
    const first = computeEntryHash({
      prev_hash: "", actor: 3, action: "job.assign", object_type: "JobRequest", object_id: "42",
      metadata: { technician_id: 7, override_warning: true, override_reason: "Café – urgent", kg: "12.50", n: null },
      created_at_iso: "2026-10-12T19:10:00.123000+00:00",
    });
    assert.equal(first, "66299b2c29a082735392dffd0ca510e74a01f38644b7ce347d42e620978f1d4b");

    const second = computeEntryHash({
      prev_hash: "abc123", actor: null, action: "credential.platform_verified", object_type: "Credential", object_id: "9",
      metadata: {}, created_at_iso: "2026-10-12T19:11:05+00:00",
    });
    assert.equal(second, "70dbd0124c2f42b4e22b7a1b988de2fa979756f9cca82a9824c5dbf67b58b5d1");
  });

  it("computes the same passport digest, so printed passports still verify", () => {
    const technician = { public_token: "11111111-2222-3333-4444-555555555555" };
    const digest = computeDigest(
      technician,
      { displayName: "Arjun Señor", contractor: null },
      [
        { capability_type: "safety", label: "Ammonia Safety" },
        { capability_type: "equipment", label: "Commercial Chiller" },
      ],
      [
        { name: "OSHA 10", issuer_name: "OSHA", expiry_date: null },
        { name: "EPA 608", issuer_name: "EPA", expiry_date: "2030-01-01" },
      ]
    );
    assert.equal(digest, "b912173c39daf26c832e958f8c562a36b5fbc8d35a6218a8a657a49be3018360");
  });
});
