import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  as, http, makeContractor, makeEquipment, makeFacility, makeJob, makeRefrigerants, makeTechnician, makeUser, models,
  reset, start, stop, verifiedSkill,
} from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

const uploadCredential = (token, technicianId, fields = {}) => {
  let req = http()
    .post("/api/credentials/")
    .set(as(token))
    .field("technician", String(technicianId))
    .field("name", fields.name ?? "EPA 608")
    .field("issuer_name", fields.issuer_name ?? "EPA")
    .field("credential_number", fields.credential_number ?? "C-100")
    .field("expiry_date", fields.expiry_date ?? "2030-01-01");
  if (fields.issue_date) req = req.field("issue_date", fields.issue_date);
  return req.attach("file", fields.file ?? PDF, { filename: "card.pdf", contentType: "application/pdf" });
};

describe("credentials", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("lets a technician upload their own and shows the stored file as an absolute URL", async () => {
    const tech = await makeTechnician(null);
    const res = await uploadCredential(tech.token, tech.profile._id);
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.effective_status, "pending");
    assert.match(res.body.file, /^http:\/\/127\.0\.0\.1:\d+\/media\/credentials\/.+-card\.pdf$/);
    assert.equal(res.body.ai_check, undefined, "technicians never see the AI review aid");
  });

  it("refuses a technician uploading for someone else, or without a file", async () => {
    const tech = await makeTechnician(null);
    const other = await makeTechnician(null);
    assert.equal((await uploadCredential(tech.token, other.profile._id)).status, 403);

    const noFile = await http()
      .post("/api/credentials/")
      .set(as(tech.token))
      .field("technician", String(tech.profile._id))
      .field("name", "X")
      .field("issuer_name", "Y");
    assert.equal(noFile.status, 400);
    assert.ok(noFile.body.file);
  });

  it("serves stored files back, and forces non-image types to download", async () => {
    const tech = await makeTechnician(null);
    const created = await uploadCredential(tech.token, tech.profile._id);
    const path = new URL(created.body.file).pathname;
    const res = await http().get(path);
    assert.equal(res.status, 200);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  it("only lets admins verify, records it, and notifies the technician", async () => {
    const tech = await makeTechnician(null);
    const admin = await makeUser("admin");
    const created = (await uploadCredential(tech.token, tech.profile._id)).body;

    assert.equal((await http().post(`/api/credentials/${created.id}/verify/`).set(as(tech.token)).send({ status: "platform_verified" })).status, 403);
    assert.equal((await http().post(`/api/credentials/${created.id}/verify/`).set(as(admin.token)).send({ status: "bogus" })).status, 400);

    const ok = await http().post(`/api/credentials/${created.id}/verify/`).set(as(admin.token)).send({ status: "platform_verified", notes: "Checked" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, "platform_verified");
    assert.equal(ok.body.notes, "Checked");
    assert.equal(ok.body.reviewed_by, admin.user._id);
    assert.ok(Array.isArray(Object.keys(ok.body).filter((k) => k === "ai_check")), "admins do see ai_check");

    const note = await models.Notification.findOne({ user: tech.user._id }).lean();
    assert.equal(note.title, "Credential platform verified");
    assert.ok(await models.AuditLog.findOne({ action: "credential.platform_verified" }));
  });

  it("reports a platform-verified credential past its expiry as expired, but leaves a pending one alone", async () => {
    const tech = await makeTechnician(null);
    const make = (status, expiry) =>
      models.Credential.create({
        technician: tech.profile._id, name: `c-${status}-${expiry}`, issuer_name: "EPA", file: "credentials/x.pdf", status, expiry_date: expiry,
      });
    const expired = await make("platform_verified", "2020-01-01");
    const future = await make("platform_verified", "2099-01-01");
    const pending = await make("pending", "2020-01-01");

    const list = await http().get("/api/credentials/").set(as(tech.token));
    const by = Object.fromEntries(list.body.results.map((c) => [c.id, c.effective_status]));
    assert.equal(by[expired._id], "expired");
    assert.equal(by[future._id], "platform_verified");
    assert.equal(by[pending._id], "pending");
  });

  it("cannot be widened with a query parameter: ?technician= narrows, never leaks", async () => {
    const mine = await makeTechnician(null);
    const theirs = await makeTechnician(null);
    await uploadCredential(mine.token, mine.profile._id, { name: "Mine" });
    await uploadCredential(theirs.token, theirs.profile._id, { name: "Theirs" });

    const res = await http().get("/api/credentials/").query({ technician: theirs.profile._id }).set(as(mine.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0);
  });

  it("returns 404 for another technician's credential", async () => {
    const mine = await makeTechnician(null);
    const theirs = await makeTechnician(null);
    const created = (await uploadCredential(theirs.token, theirs.profile._id)).body;
    assert.equal((await http().get(`/api/credentials/${created.id}/`).set(as(mine.token))).status, 404);
  });

  it("limits technician profiles and evidence to the contractor's own roster", async () => {
    const managerA = await makeUser("contractor_manager");
    const managerB = await makeUser("contractor_manager");
    const companyA = await makeContractor(managerA.user);
    const companyB = await makeContractor(managerB.user);
    const techA = await makeTechnician(companyA);
    const techB = await makeTechnician(companyB);
    const credentialA = (await uploadCredential(techA.token, techA.profile._id)).body;
    const credentialB = (await uploadCredential(techB.token, techB.profile._id)).body;

    const roster = await http().get("/api/technicians/").set(as(managerA.token));
    assert.deepEqual(roster.body.results.map((profile) => profile.id), [techA.profile._id]);
    assert.equal((await http().get(`/api/technicians/${techB.profile._id}/`).set(as(managerA.token))).status, 404);
    assert.equal((await http().get("/api/technicians/").set(as(techA.token))).body.count, 1);
    assert.equal((await http().get(`/api/technicians/${techB.profile._id}/`).set(as(techA.token))).status, 404);

    const evidence = await http().get("/api/credentials/").set(as(managerA.token));
    assert.deepEqual(evidence.body.results.map((credential) => credential.id), [credentialA.id]);
    assert.equal((await http().get(`/api/credentials/${credentialB.id}/`).set(as(managerA.token))).status, 404);
    assert.equal(
      (await http().patch(`/api/credentials/${credentialA.id}/`).set(as(managerA.token)).send({ name: "Changed" })).status,
      403,
    );
    assert.equal((await http().get("/api/credentials/").set(as(managerB.token))).body.count, 1);

    const attemptedTransfer = await http()
      .patch(`/api/technicians/${techA.profile._id}/`)
      .set(as(techA.token))
      .send({ contractor: companyB._id });
    assert.equal(attemptedTransfer.status, 403);
    assert.equal((await models.TechnicianProfile.findById(techA.profile._id).lean()).contractor, companyA._id);
  });
});

describe("capabilities", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const declare = (token, body) => http().post("/api/capabilities/").set(as(token)).send(body);

  it("declares each kind with only its own target field", async () => {
    const r = await makeRefrigerants();
    const tech = await makeTechnician(null);
    const base = { technician: tech.profile._id };

    const equipment = await declare(tech.token, { ...base, capability_type: "equipment", equipment_category: "vrf_system" });
    assert.equal(equipment.status, 201);
    assert.equal(equipment.body.label, "VRF System");
    assert.equal(equipment.body.status, "pending");

    const refrigerant = await declare(tech.token, { ...base, capability_type: "refrigerant", refrigerant_type: r.r32._id });
    assert.equal(refrigerant.body.label, "R-32");
    assert.equal(refrigerant.body.refrigerant_type_code, "R-32");

    const safety = await declare(tech.token, { ...base, capability_type: "safety", safety_domain: "leak_detection" });
    assert.equal(safety.body.label, "Leak Detection");
  });

  it("rejects missing targets and duplicates cleanly", async () => {
    const tech = await makeTechnician(null);
    const base = { technician: tech.profile._id };
    const missing = await declare(tech.token, { ...base, capability_type: "equipment" });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body.equipment_category, ["Required for equipment capabilities."]);

    const body = { ...base, capability_type: "safety", safety_domain: "leak_detection" };
    assert.equal((await declare(tech.token, body)).status, 201);
    const dup = await declare(tech.token, body);
    assert.equal(dup.status, 400);
    assert.deepEqual(dup.body.non_field_errors, ["This capability has already been declared for this technician."]);
  });

  it("sends an edited capability back to pending for re-verification", async () => {
    const tech = await makeTechnician(null);
    const skill = await verifiedSkill(tech.profile, { capability_type: "safety", safety_domain: "leak_detection" });
    const res = await http().patch(`/api/capabilities/${skill._id}/`).set(as(tech.token)).send({ note: "More experience now" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.verified_at, null);
  });

  it("lets the roster's contractor manager or an admin verify, and nobody else", async () => {
    const manager = await makeUser("contractor_manager");
    const company = await makeContractor(manager.user);
    const tech = await makeTechnician(company);
    const skill = await models.CapabilitySkill.create({
      technician: tech.profile._id, capability_type: "safety", safety_domain: "leak_detection",
    });
    const stranger = await makeUser("contractor_manager");
    const url = `/api/capabilities/${skill._id}/verify/`;

    assert.equal((await http().post(url).set(as(tech.token)).send({ status: "verified" })).status, 403);
    assert.equal((await http().post(url).set(as(stranger.token)).send({ status: "verified" })).status, 403);
    const ok = await http().post(url).set(as(manager.token)).send({ status: "verified", note: "Seen it done" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, "verified");
    assert.equal(ok.body.verified_by, manager.user._id);
  });

  it("will not let a technician add to or read another technician's capabilities", async () => {
    const a = await makeTechnician(null);
    const b = await makeTechnician(null);
    const res = await declare(a.token, { technician: b.profile._id, capability_type: "safety", safety_domain: "leak_detection" });
    assert.equal(res.status, 403);

    await verifiedSkill(b.profile, { capability_type: "safety", safety_domain: "leak_detection" });
    const peek = await http().get("/api/capabilities/").query({ technician: b.profile._id }).set(as(a.token));
    assert.equal(peek.body.count, 0);
  });
});

describe("contractors", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("scores compliance from verified capabilities, credentials and documents", async () => {
    const manager = await makeUser("contractor_manager");
    const company = await makeContractor(manager.user);
    const a = await makeTechnician(company);
    await models.CapabilitySkill.create({ technician: a.profile._id, capability_type: "safety", safety_domain: "leak_detection", status: "verified" });
    await models.CapabilitySkill.create({ technician: a.profile._id, capability_type: "safety", safety_domain: "vacuum_evacuation", status: "pending" });
    await models.Credential.create({
      technician: a.profile._id, name: "ok", issuer_name: "EPA", file: "credentials/x.pdf", status: "platform_verified", expiry_date: "2099-01-01",
    });
    await models.ContractorDocument.create({ company: company._id, doc_type: "insurance", file: "contractor_documents/x.pdf", status: "verified" });

    const res = await http().get(`/api/contractors/${company._id}/compliance/`).set(as(manager.token));
    assert.equal(res.status, 200);
    // 50% capabilities * 50 + 100% credentials * 30 + 100% documents * 20
    assert.deepEqual(res.body, {
      score: 75, technician_count: 1, capability_verified_rate: 50, credential_verified_rate: 100,
      document_verified_rate: 100, company_verified: true,
    });
  });

  it("scores zero with an empty roster", async () => {
    const manager = await makeUser("contractor_manager");
    const company = await makeContractor(manager.user, { verification_status: "pending" });
    const res = await http().get(`/api/contractors/${company._id}/compliance/`).set(as(manager.token));
    assert.equal(res.body.score, 0);
    assert.equal(res.body.company_verified, false);
  });

  it("registers, then lets only the manager manage the roster", async () => {
    const manager = await makeUser("contractor_manager");
    const intruder = await makeUser("contractor_manager");
    const tech = await makeTechnician(null);

    const created = await http().post("/api/contractors/").set(as(manager.token)).send({ name: "ACME Cooling", service_area: "Pune" });
    assert.equal(created.status, 201);
    assert.equal(created.body.verification_status, "pending");

    const id = created.body.id;
    assert.equal((await http().post(`/api/contractors/${id}/add-technician/`).set(as(intruder.token)).send({ technician_id: tech.profile._id })).status, 404);
    const added = await http().post(`/api/contractors/${id}/add-technician/`).set(as(manager.token)).send({ technician_id: tech.profile._id });
    assert.equal(added.status, 200);
    assert.equal(added.body.contractor, id);
    assert.equal(added.body.contractor_name, "ACME Cooling");

    const roster = await http().get(`/api/contractors/${id}/technicians/`).set(as(manager.token));
    assert.equal(roster.body.length, 1);

    assert.equal((await http().post(`/api/contractors/${id}/remove-technician/`).set(as(manager.token)).send({ technician_id: tech.profile._id })).status, 204);
    assert.equal((await models.TechnicianProfile.findById(tech.profile._id).lean()).contractor, null);
  });

  it("keeps verification in admin hands, and audits it", async () => {
    const manager = await makeUser("contractor_manager");
    const admin = await makeUser("admin");
    const company = await makeContractor(manager.user, { verification_status: "pending" });

    const self = await http().post(`/api/contractors/${company._id}/verify/`).set(as(manager.token)).send({ verification_status: "verified" });
    assert.equal(self.status, 403);
    assert.equal((await http().post(`/api/contractors/${company._id}/verify/`).set(as(admin.token)).send({ verification_status: "nonsense" })).status, 400);
    const ok = await http().post(`/api/contractors/${company._id}/verify/`).set(as(admin.token)).send({ verification_status: "verified" });
    assert.equal(ok.body.verification_status, "verified");
    assert.ok(await models.AuditLog.findOne({ action: "contractor.verified", object_type: "ContractorCompany" }));
  });

  it("uploads documents for the managed company only, and admins review them", async () => {
    const manager = await makeUser("contractor_manager");
    const other = await makeUser("contractor_manager");
    const admin = await makeUser("admin");
    const company = await makeContractor(manager.user);

    const send = (token) =>
      http().post("/api/contractor-documents/").set(as(token)).field("company", String(company._id)).field("doc_type", "insurance")
        .attach("file", PDF, { filename: "policy.pdf", contentType: "application/pdf" });
    assert.equal((await send(other.token)).status, 403);
    const created = await send(manager.token);
    assert.equal(created.status, 201);
    assert.equal(created.body.company_name, "Test Contractor");

    assert.equal((await http().post(`/api/contractor-documents/${created.body.id}/verify/`).set(as(manager.token)).send({ status: "verified" })).status, 403);
    const ok = await http().post(`/api/contractor-documents/${created.body.id}/verify/`).set(as(admin.token)).send({ status: "verified" });
    assert.equal(ok.body.status, "verified");
  });
});

describe("technician passport and public verification", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  async function verifiedTechnician() {
    const r = await makeRefrigerants();
    const manager = await makeUser("contractor_manager");
    const company = await makeContractor(manager.user, { name: "CoolTech" });
    const tech = await makeTechnician(company, { years_experience: 7 });
    const skill = await verifiedSkill(tech.profile, { capability_type: "refrigerant", refrigerant_type: r.r32._id });
    await verifiedSkill(tech.profile, { capability_type: "equipment", equipment_category: "vrf_system" });
    await models.CapabilitySkill.create({ technician: tech.profile._id, capability_type: "safety", safety_domain: "leak_detection", status: "pending" });
    await models.Credential.create({
      technician: tech.profile._id, name: "EPA 608", issuer_name: "EPA", file: "credentials/x.pdf", status: "platform_verified", expiry_date: "2099-01-01",
    });
    await models.Credential.create({
      technician: tech.profile._id, name: "Stale", issuer_name: "EPA", file: "credentials/x.pdf", status: "platform_verified", expiry_date: "2001-01-01",
    });
    await models.Credential.create({ technician: tech.profile._id, name: "Waiting", issuer_name: "EPA", file: "credentials/x.pdf", status: "pending" });
    return { tech, skill };
  }

  it("shows only verified, current facts and no contact details", async () => {
    const { tech } = await verifiedTechnician();
    const res = await http().get(`/api/public/technicians/${tech.profile.public_token}/`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), [
      "contractor_name", "full_name", "verified_capabilities", "verified_credentials", "years_experience",
    ]);
    assert.equal(res.body.contractor_name, "CoolTech");
    assert.deepEqual(res.body.verified_capabilities.map((c) => c.label).sort(), ["R-32", "VRF System"]);
    assert.deepEqual(res.body.verified_credentials.map((c) => c.name), ["EPA 608"]);
    assert.ok(!JSON.stringify(res.body).includes("@test.local"));
  });

  it("404s for an unknown token", async () => {
    assert.equal((await http().get("/api/public/technicians/00000000-0000-0000-0000-000000000000/")).status, 404);
    assert.equal((await http().get("/api/public/technicians/not-a-token/")).status, 404);
  });

  it("serves a QR image and a PDF passport without signing in", async () => {
    const { tech } = await verifiedTechnician();
    const qr = await http().get(`/api/public/technicians/${tech.profile.public_token}/qr/`);
    assert.equal(qr.status, 200);
    assert.equal(qr.headers["content-type"], "image/png");

    const pdf = await http().get(`/api/public/technicians/${tech.profile.public_token}/passport.pdf`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers["content-type"], "application/pdf");
    assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
  });

  it("goes outdated the moment a verified capability is revoked", async () => {
    const { tech, skill } = await verifiedTechnician();
    const token = tech.profile.public_token;
    const { passportDigest } = await import("../src/services/passport.js");
    const digest = await passportDigest(tech.profile);

    const verify = (hash) => http().get(`/api/public/technicians/${token}/passport/verify/`).query({ hash });
    const fresh = await verify(digest);
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.valid, true);

    await models.CapabilitySkill.updateOne({ _id: skill._id }, { status: "not_qualified" });
    const outdated = await verify(digest);
    assert.equal(outdated.body.valid, false);

    assert.equal((await http().get(`/api/public/technicians/${token}/passport/verify/`)).status, 400);
  });
});
