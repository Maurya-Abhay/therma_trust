import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  as, dec, http, makeContractor, makeEquipment, makeFacility, makeJob, makeRefrigerants, makeTechnician, makeUser, models,
  outbox, reset, start, stop,
} from "./helpers.js";
import { recordAudit, verifyChain } from "../src/services/audit.js";
import { setPushSender } from "../src/services/push.js";
import { setExtractor } from "../src/services/ocr.js";
import { config } from "../src/config.js";

const binary = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

describe("audit chain", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("links every entry to the previous one and verifies", async () => {
    const admin = await makeUser("admin");
    const a = await recordAudit(admin.user, "x.one", "Thing", 1, { n: 1 });
    const b = await recordAudit(admin.user, "x.two", "Thing", 2, { n: 2 });
    assert.equal(a.prev_hash, "");
    assert.equal(b.prev_hash, a.entry_hash);
    assert.deepEqual(await verifyChain(), { valid: true, brokenAtId: null, checked: 2 });
  });

  it("stays linear when many entries are written at once", async () => {
    const admin = await makeUser("admin");
    await Promise.all(Array.from({ length: 12 }, (_, i) => recordAudit(admin.user, `bulk.${i}`, "Thing", i)));
    const result = await verifyChain();
    assert.equal(result.valid, true);
    assert.equal(result.checked, 12);
  });

  it("detects an edited row and a deleted row", async () => {
    const admin = await makeUser("admin");
    const first = await recordAudit(admin.user, "x.one", "Thing", 1);
    await recordAudit(admin.user, "x.two", "Thing", 2);
    await recordAudit(admin.user, "x.three", "Thing", 3);

    await models.AuditLog.updateOne({ _id: first._id }, { action: "x.edited" });
    assert.equal((await verifyChain()).valid, false);
    assert.equal((await verifyChain()).brokenAtId, first._id);

    await models.AuditLog.updateOne({ _id: first._id }, { action: "x.one" });
    assert.equal((await verifyChain()).valid, true);
    await models.AuditLog.deleteOne({ _id: first._id + 1 });
    assert.equal((await verifyChain()).valid, false);
  });

  it("is only checkable by admins over the API", async () => {
    const admin = await makeUser("admin");
    const tech = await makeTechnician(null);
    await recordAudit(admin.user, "x.one", "Thing", 1);
    assert.equal((await http().get("/api/audit/verify/").set(as(tech.token))).status, 403);
    const ok = await http().get("/api/audit/verify/").set(as(admin.token));
    assert.deepEqual(ok.body, { valid: true, broken_at_id: null, checked_count: 1 });
  });
});

describe("alerts", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const alerts = async (token) => (await http().get("/api/alerts/").set(as(token))).body;

  it("warns a facility manager about leaky equipment and drifting readings, and nothing when fine", async () => {
    const fm = await makeUser("facility_manager");
    const tech = await makeTechnician(null);
    const r = await makeRefrigerants();
    const facility = await makeFacility(fm.user);
    const unit = await makeEquipment(facility, r.r134a, { name: "Walk-in", refrigerant_charge_kg: dec(50) });
    assert.deepEqual(await alerts(fm.token), []);

    for (const [i, superheat] of [6, 8, 11].entries()) {
      const job = await makeJob(facility, unit, fm.user);
      await models.ServiceReport.create({
        job: job._id, technician: tech.profile._id, fault_description: "x", refrigerant_type: r.r134a._id,
        refrigerant_added_kg: dec(i === 0 ? 12 : 0), diagnostic_readings: { superheat }, created_at: new Date(Date.now() - (3 - i) * 86_400_000),
      });
    }
    const list = await alerts(fm.token);
    assert.deepEqual(list.map((a) => [a.severity, a.category]), [["critical", "leak_rate"], ["warning", "drift"]]);
    assert.match(list[0].detail, /24\.0% of its charge was topped up .* \(limit 20%\)/);
    assert.match(list[1].detail, /6 -> 8 -> 11/);
  });

  it("warns a technician about expired and soon-to-expire verified credentials only", async () => {
    const tech = await makeTechnician(null);
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const make = (name, status, expiry) =>
      models.Credential.create({ technician: tech.profile._id, name, issuer_name: "EPA", file: "credentials/x.pdf", status, expiry_date: expiry });
    await make("Old card", "platform_verified", "2020-01-01");
    await make("New card", "platform_verified", soon);
    await make("Far card", "platform_verified", "2099-01-01");
    await make("Unverified", "pending", "2020-01-01");

    const list = await alerts(tech.token);
    assert.deepEqual(list.map((a) => [a.severity, a.title]), [
      ["critical", "Your Old card has expired"],
      ["warning", "Your New card expires in 10 days"],
    ]);
  });

  it("gives a contractor its score, unverified, pending, roster-credential and low-cylinder alerts", async () => {
    const manager = await makeUser("contractor_manager");
    const company = await makeContractor(manager.user, { verification_status: "pending" });
    const r = await makeRefrigerants();
    const tech = await makeTechnician(company);
    await models.CapabilitySkill.create({ technician: tech.profile._id, capability_type: "safety", safety_domain: "leak_detection" });
    await models.Credential.create({
      technician: tech.profile._id, name: "Old card", issuer_name: "EPA", file: "credentials/x.pdf", status: "platform_verified", expiry_date: "2020-01-01",
    });
    await models.RefrigerantCylinder.create({
      company: company._id, serial_number: "LOW-1", refrigerant_type: r.r134a._id, kind: "supply", capacity_kg: dec(50), current_kg: dec(4),
    });
    await models.RefrigerantCylinder.create({
      company: company._id, serial_number: "REC-1", refrigerant_type: r.r134a._id, kind: "recovery", capacity_kg: dec(50), current_kg: dec(1),
    });

    const list = await alerts(manager.token);
    const titles = list.map((a) => a.title);
    assert.ok(titles.includes("Test Contractor is not verified yet"));
    assert.ok(titles.includes("Test Contractor compliance score is 0/100"));
    assert.ok(titles.includes("1 capability waiting for your approval"));
    assert.ok(titles.some((t) => /^technician User\d+'s Old card has expired$/.test(t)));
    assert.ok(titles.includes("Cylinder LOW-1 is nearly empty"));
    assert.ok(!titles.some((t) => t.includes("REC-1")), "recovery cylinders are expected to be nearly empty");
    assert.equal(list[0].severity, "critical");
  });

  it("shows admins their review queues, and a critical alert if the chain is broken", async () => {
    const admin = await makeUser("admin");
    const tech = await makeTechnician(null);
    await models.Credential.create({ technician: tech.profile._id, name: "A", issuer_name: "x", file: "credentials/x.pdf" });
    await models.Credential.create({ technician: tech.profile._id, name: "B", issuer_name: "x", file: "credentials/x.pdf" });
    await models.CapabilitySkill.create({ technician: tech.profile._id, capability_type: "safety", safety_domain: "leak_detection" });

    const titles = (await alerts(admin.token)).map((a) => a.title);
    assert.deepEqual(titles, ["1 capability awaiting review", "2 credentials awaiting review"]);

    const entry = await recordAudit(admin.user, "x", "Thing", 1);
    await recordAudit(admin.user, "y", "Thing", 2);
    await models.AuditLog.updateOne({ _id: entry._id }, { action: "tampered" });
    const broken = await alerts(admin.token);
    assert.equal(broken[0].severity, "critical");
    assert.equal(broken[0].title, "Audit log tampering detected");
  });

  it("requires a login and emails only people with something actionable", async () => {
    assert.equal((await http().get("/api/alerts/")).status, 401);

    const fm = await makeUser("facility_manager");
    await makeUser("technician");
    const { sendAlertDigests } = await import("../src/services/alerts.js");
    const r = await makeRefrigerants();
    const facility = await makeFacility(fm.user);
    const unit = await makeEquipment(facility, r.r134a, { refrigerant_charge_kg: dec(10) });
    const tech = await makeTechnician(null);
    const job = await makeJob(facility, unit, fm.user);
    await models.ServiceReport.create({
      job: job._id, technician: tech.profile._id, fault_description: "x", refrigerant_type: r.r134a._id, refrigerant_added_kg: dec(5),
    });

    assert.equal(await sendAlertDigests(), 1);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, fm.user.email);
    assert.match(outbox[0].subject, /1 compliance alert need attention/);
    assert.match(outbox[0].text, /https:\/\/app\.test\/dashboard/);
  });

  it("only runs the digest endpoint with the shared cron token", async () => {
    config.alertsCronToken = "";
    assert.equal((await http().post("/api/alerts/send-digest/")).status, 403);
    config.alertsCronToken = "s3cret";
    try {
      assert.equal((await http().post("/api/alerts/send-digest/").set("X-Cron-Token", "wrong")).status, 403);
      const ok = await http().post("/api/alerts/send-digest/").set("X-Cron-Token", "s3cret");
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.body, { emails_sent: 0 });
    } finally {
      config.alertsCronToken = "";
    }
  });
});

describe("notifications, search, onboarding", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("lists newest first with an unread count and marks some or all as read", async () => {
    const tech = await makeTechnician(null);
    const other = await makeTechnician(null);
    const { notify } = await import("../src/services/notify.js");
    const first = await notify(tech.user._id, "job", "First", "", "/a");
    await new Promise((r) => setTimeout(r, 5));
    await notify(tech.user._id, "info", "Second");
    await notify(other.user._id, "info", "Someone else's");

    const list = await http().get("/api/notifications/").set(as(tech.token));
    assert.equal(list.body.unread_count, 2);
    assert.deepEqual(list.body.results.map((n) => n.title), ["Second", "First"]);

    await http().post("/api/notifications/read/").set(as(tech.token)).send({ ids: [first._id] });
    assert.equal((await http().get("/api/notifications/").set(as(tech.token))).body.unread_count, 1);
    // another person's id in the list is ignored
    const theirs = await models.Notification.findOne({ user: other.user._id }).lean();
    await http().post("/api/notifications/read/").set(as(tech.token)).send({ ids: [theirs._id] });
    assert.equal((await models.Notification.findById(theirs._id).lean()).read_at, null);

    await http().post("/api/notifications/read/").set(as(tech.token)).send({ all: true });
    assert.equal((await http().get("/api/notifications/").set(as(tech.token))).body.unread_count, 0);
  });

  it("searches only what each role may see", async () => {
    const fm = await makeUser("facility_manager");
    const other = await makeUser("facility_manager");
    const r = await makeRefrigerants();
    const mine = await makeFacility(fm.user, { name: "Harbour Cold Store" });
    const theirs = await makeFacility(other.user, { name: "Harbour Secret Store" });
    await makeEquipment(mine, r.r134a, { name: "Harbour chiller" });
    await makeEquipment(theirs, r.r134a, { name: "Harbour hidden unit" });

    const res = await http().get("/api/search/").query({ q: "harbour" }).set(as(fm.token));
    const titles = res.body.results.map((x) => x.title).sort();
    assert.deepEqual(titles, ["Harbour Cold Store", "Harbour chiller"]);
    assert.deepEqual((await http().get("/api/search/").query({ q: "h" }).set(as(fm.token))).body.results, []);
    // regex characters are searched literally
    assert.deepEqual((await http().get("/api/search/").query({ q: ".*" }).set(as(fm.token))).body.results, []);
  });

  it("derives the onboarding checklist from real data", async () => {
    const fm = await makeUser("facility_manager");
    const empty = (await http().get("/api/onboarding/").set(as(fm.token))).body;
    assert.deepEqual([empty.completed, empty.total], [0, 4]);

    const r = await makeRefrigerants();
    const facility = await makeFacility(fm.user);
    await makeEquipment(facility, r.r134a);
    const after = (await http().get("/api/onboarding/").set(as(fm.token))).body;
    assert.deepEqual(after.steps.map((s) => s.done), [true, true, false, false]);
    assert.equal(after.completed, 2);

    const admin = await makeUser("admin");
    assert.deepEqual((await http().get("/api/onboarding/").set(as(admin.token))).body, { steps: [], completed: 0, total: 0 });
  });

  it("serves the dropdown choices and refrigerant types", async () => {
    const fm = await makeUser("facility_manager");
    await makeRefrigerants();
    const choices = await http().get("/api/choices/").set(as(fm.token));
    assert.ok(choices.body.equipment_categories.some((c) => c.value === "vrf_system" && c.label === "VRF System"));
    assert.equal(choices.body.job_statuses.length, 5);

    const types = await http().get("/api/refrigerant-types/").set(as(fm.token));
    assert.deepEqual(types.body.results.map((t) => t.code), ["R-134a", "R-32", "R-717", "R-744"]);
  });
});

describe("push alerts", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  const sent = [];
  const KEYS = { p256dh: "BP-key", auth: "auth-secret" };
  const subscribe = (token, endpoint = "https://push.example.test/abc") =>
    http().post("/api/notifications/push/subscribe/").set(as(token)).send({ endpoint, keys: KEYS });

  beforeEach(() => {
    sent.length = 0;
    config.vapid.publicKey = "";
    config.vapid.privateKey = "";
    setPushSender(async (subscription, payload) => {
      sent.push({ subscription, payload: JSON.parse(payload) });
    });
  });
  after(() => {
    config.vapid.publicKey = "";
    config.vapid.privateKey = "";
  });

  it("reports disabled without keys and only ever serves the public key", async () => {
    const tech = await makeTechnician(null);
    assert.deepEqual((await http().get("/api/notifications/push/key/").set(as(tech.token))).body, { enabled: false, public_key: "" });
    config.vapid.publicKey = "PUB";
    config.vapid.privateKey = "PRIV";
    const body = (await http().get("/api/notifications/push/key/").set(as(tech.token))).body;
    assert.deepEqual(body, { enabled: true, public_key: "PUB" });
  });

  it("stores subscriptions per endpoint, moves them between users, and removes only your own", async () => {
    const a = await makeTechnician(null);
    const b = await makeTechnician(null);
    assert.equal((await subscribe(a.token)).status, 201);
    assert.equal((await subscribe(a.token)).status, 201);
    assert.equal(await models.PushSubscription.countDocuments(), 1);
    await subscribe(b.token);
    assert.equal((await models.PushSubscription.findOne({}).lean()).user, b.user._id);

    const wrong = await http().post("/api/notifications/push/unsubscribe/").set(as(a.token)).send({ endpoint: "https://push.example.test/abc" });
    assert.deepEqual(wrong.body, { removed: 0 });
    const right = await http().post("/api/notifications/push/unsubscribe/").set(as(b.token)).send({ endpoint: "https://push.example.test/abc" });
    assert.deepEqual(right.body, { removed: 1 });
  });

  it("rejects insecure endpoints and missing keys", async () => {
    const tech = await makeTechnician(null);
    const bad = await http().post("/api/notifications/push/subscribe/").set(as(tech.token)).send({ endpoint: "http://x", keys: KEYS });
    assert.equal(bad.status, 400);
    const noKeys = await http().post("/api/notifications/push/subscribe/").set(as(tech.token)).send({ endpoint: "https://x.test/a" });
    assert.equal(noKeys.status, 400);
  });

  it("pushes each new notification to the owner's devices only, and drops dead ones", async () => {
    config.vapid.publicKey = "PUB";
    config.vapid.privateKey = "PRIV";
    const tech = await makeTechnician(null);
    const other = await makeTechnician(null);
    await subscribe(tech.token, "https://push.example.test/one");
    await subscribe(tech.token, "https://push.example.test/two");
    await subscribe(other.token, "https://push.example.test/three");

    const { notify } = await import("../src/services/notify.js");
    const note = await notify(tech.user._id, "job", "New job assigned", "Chiller 3", "/my-jobs");
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[0].payload, { title: "New job assigned", body: "Chiller 3", url: "/my-jobs", kind: "job", id: note._id });

    setPushSender(async (subscription) => {
      if (subscription.endpoint.endsWith("/two")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      throw Object.assign(new Error("busy"), { statusCode: 503 });
    });
    await notify(tech.user._id, "info", "Again");
    const left = (await models.PushSubscription.find({ user: tech.user._id }).lean()).map((s) => s.endpoint);
    assert.deepEqual(left, ["https://push.example.test/one"]);
    assert.ok(await models.Notification.findOne({ user: tech.user._id, title: "Again" }), "the notification itself survives a push failure");
  });

  it("sends a confirmation push from the test endpoint", async () => {
    config.vapid.publicKey = "PUB";
    config.vapid.privateKey = "PRIV";
    const tech = await makeTechnician(null);
    await subscribe(tech.token);
    assert.equal((await http().post("/api/notifications/push/test/").set(as(tech.token))).status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].payload.title, "Push alerts are on");
  });
});

describe("assessments", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  async function setup() {
    const assessment = await models.Assessment.create({
      title: "Ammonia Safety", capability_type: "safety", safety_domain: "ammonia_safety", pass_score_percent: 75,
    });
    for (const [order, correct] of [[0, 1], [1, 2], [2, 0], [3, 1]]) {
      await models.AssessmentQuestion.create({ assessment: assessment._id, prompt: `Q${order}`, choices: ["a", "b", "c"], correct_index: correct, order });
    }
    return assessment;
  }

  it("never reveals the answer key", async () => {
    const tech = await makeTechnician(null);
    await setup();
    const res = await http().get("/api/assessments/").set(as(tech.token));
    assert.equal(res.body.results[0].questions.length, 4);
    assert.equal(res.body.results[0].target_label, "Ammonia Safety");
    assert.ok(!JSON.stringify(res.body).includes("correct_index"));
  });

  it("verifies the capability on a pass, and leaves it alone on a fail", async () => {
    const tech = await makeTechnician(null);
    const assessment = await setup();

    const failed = await http().post(`/api/assessments/${assessment._id}/submit/`).set(as(tech.token)).send({ answers: [0, 0, 1, 2] });
    assert.equal(failed.status, 201);
    assert.equal(failed.body.passed, false);
    assert.equal(failed.body.capability_status, null);
    assert.equal(await models.CapabilitySkill.countDocuments(), 0);

    const passed = await http().post(`/api/assessments/${assessment._id}/submit/`).set(as(tech.token)).send({ answers: [1, 2, 0, 1] });
    assert.equal(passed.body.score_percent, 100);
    assert.equal(passed.body.capability_status, "verified");
    const skill = await models.CapabilitySkill.findOne({}).lean();
    assert.equal(skill.evidence_type, "practical_assessment");
    assert.equal(skill.safety_domain, "ammonia_safety");

    // taking it again updates the same capability rather than duplicating it
    await http().post(`/api/assessments/${assessment._id}/submit/`).set(as(tech.token)).send({ answers: [1, 2, 0, 1] });
    assert.equal(await models.CapabilitySkill.countDocuments(), 1);
  });

  it("validates the answer count and who may take it", async () => {
    const tech = await makeTechnician(null);
    const fm = await makeUser("facility_manager");
    const assessment = await setup();
    const short = await http().post(`/api/assessments/${assessment._id}/submit/`).set(as(tech.token)).send({ answers: [1] });
    assert.equal(short.status, 400);
    assert.match(short.body.detail, /Expected 4 answers, got 1/);
    assert.equal((await http().post(`/api/assessments/${assessment._id}/submit/`).set(as(fm.token)).send({ answers: [1, 2, 0, 1] })).status, 403);
  });
});

describe("facilities and equipment", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("creates, lists with counts, scopes and cascades", async () => {
    const fm = await makeUser("facility_manager");
    const other = await makeUser("facility_manager");
    const r = await makeRefrigerants();

    const created = await http().post("/api/facilities/").set(as(fm.token)).send({
      name: "Dock 4", address: "1 Quay Rd", service_area: "Pune", segment: "supermarket_refrigeration",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.owner, fm.user._id);
    assert.equal(created.body.equipment_count, 0);

    const unit = await http().post("/api/equipment/").set(as(fm.token)).send({
      facility: created.body.id, name: "Rack A", category: "supermarket_refrigeration", refrigerant_type: r.r744._id,
      refrigerant_charge_kg: "42.50", install_date: "2024-05-01",
    });
    assert.equal(unit.status, 201);
    assert.equal(unit.body.refrigerant_charge_kg, "42.50");
    assert.equal(unit.body.category_display, "Supermarket Refrigeration");
    assert.equal(unit.body.refrigerant_type_code, "R-744");

    const list = await http().get("/api/facilities/").set(as(fm.token));
    assert.equal(list.body.results[0].equipment_count, 1);
    assert.equal((await http().get("/api/facilities/").set(as(other.token))).body.count, 0);
    assert.equal((await http().get(`/api/facilities/${created.body.id}/`).set(as(other.token))).status, 404);
    // ?facility= may not be used to look into someone else's equipment
    const peek = await http().get("/api/equipment/").query({ facility: created.body.id }).set(as(other.token));
    assert.equal(peek.body.count, 0);

    const noFacility = await http().post("/api/equipment/").set(as(other.token)).send({
      facility: created.body.id, name: "Sneaky", category: "vrf_system", refrigerant_type: r.r32._id,
    });
    assert.equal(noFacility.status, 403);

    assert.equal((await http().delete(`/api/facilities/${created.body.id}/`).set(as(fm.token))).status, 204);
    assert.equal(await models.Equipment.countDocuments(), 0);
  });

  it("limits facility and equipment access to owners and job-related roles", async () => {
    const ownerA = await makeUser("facility_manager");
    const ownerB = await makeUser("facility_manager");
    const contractorA = await makeUser("contractor_manager");
    const contractorB = await makeUser("contractor_manager");
    const companyA = await makeContractor(contractorA.user);
    const companyB = await makeContractor(contractorB.user);
    const techA = await makeTechnician(companyA);
    const techB = await makeTechnician(companyB);
    const unassigned = await makeTechnician(null);
    const admin = await makeUser("admin");
    const refrigerants = await makeRefrigerants();
    const facilityA = await makeFacility(ownerA.user);
    const facilityB = await makeFacility(ownerB.user);
    const unitA = await makeEquipment(facilityA, refrigerants.r134a);
    const unitB = await makeEquipment(facilityB, refrigerants.r32);
    const jobA = await makeJob(facilityA, unitA, ownerA.user);
    const jobB = await makeJob(facilityB, unitB, ownerB.user);
    await models.JobAssignment.create({ job: jobA._id, technician: techA.profile._id, assigned_by: ownerA.user._id });
    await models.JobAssignment.create({ job: jobB._id, technician: techB.profile._id, assigned_by: ownerB.user._id });

    const viewers = [
      [ownerA.token, facilityA._id],
      [ownerB.token, facilityB._id],
      [contractorA.token, facilityA._id],
      [contractorB.token, facilityB._id],
      [techA.token, facilityA._id],
      [techB.token, facilityB._id],
      [unassigned.token, null],
    ];
    for (const [token, expectedId] of viewers) {
      const facilities = await http().get("/api/facilities/").set(as(token));
      const equipment = await http().get("/api/equipment/").set(as(token));
      assert.deepEqual(facilities.body.results.map((item) => item.id), expectedId === facilityA._id ? [facilityA._id] : expectedId === facilityB._id ? [facilityB._id] : []);
      assert.deepEqual(equipment.body.results.map((item) => item.id), expectedId === facilityA._id ? [unitA._id] : expectedId === facilityB._id ? [unitB._id] : []);
    }

    const allFacilities = await http().get("/api/facilities/").set(as(admin.token));
    const allEquipment = await http().get("/api/equipment/").set(as(admin.token));
    assert.equal(allFacilities.body.count, 2);
    assert.equal(allEquipment.body.count, 2);
    assert.equal((await http().get(`/api/facilities/${facilityB._id}/`).set(as(ownerA.token))).status, 404);
    assert.equal((await http().get(`/api/equipment/${unitB._id}/`).set(as(techA.token))).status, 404);

    const facilityBody = { name: "Unauthorized", address: "Nowhere", service_area: "None" };
    assert.equal((await http().post("/api/facilities/").set(as(techA.token)).send(facilityBody)).status, 403);
    assert.equal((await http().patch(`/api/equipment/${unitA._id}/`).set(as(techA.token)).send({ name: "Changed" })).status, 403);
    assert.equal((await http().delete(`/api/equipment/${unitA._id}/`).set(as(contractorA.token))).status, 403);
  });

  it("reports field errors in the shape the forms read", async () => {
    const fm = await makeUser("facility_manager");
    const res = await http().post("/api/facilities/").set(as(fm.token)).send({ name: "", segment: "moon_base" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.name, ["This field may not be blank."]);
    assert.deepEqual(res.body.address, ["This field is required."]);
    assert.match(res.body.segment[0], /"moon_base" is not a valid choice/);
  });

  it("prints an equipment label PDF for its facility manager only", async () => {
    const fm = await makeUser("facility_manager");
    const other = await makeUser("facility_manager");
    const r = await makeRefrigerants();
    const unit = await makeEquipment(await makeFacility(fm.user), r.r134a, { name: "Chiller 9", refrigerant_charge_kg: dec(12) });

    const ok = await http().get(`/api/equipment/${unit._id}/label/`).set(as(fm.token)).buffer(true).parse(binary);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.subarray(0, 4).toString(), "%PDF");
    assert.match(ok.headers["content-disposition"], new RegExp(`equipment-label-${unit._id}\\.pdf`));
    assert.equal((await http().get(`/api/equipment/${unit._id}/label/`).set(as(other.token))).status, 404);
  });

  it("paginates in 50s with absolute next and previous links", async () => {
    const fm = await makeUser("facility_manager");
    for (let i = 0; i < 53; i += 1) await makeFacility(fm.user, { name: `F${i}` });
    const first = await http().get("/api/facilities/").set(as(fm.token));
    assert.equal(first.body.count, 53);
    assert.equal(first.body.results.length, 50);
    assert.match(first.body.next, /^http:\/\/.+\/api\/facilities\/\?page=2$/);
    const second = await http().get("/api/facilities/").query({ page: 2 }).set(as(fm.token));
    assert.equal(second.body.results.length, 3);
    assert.equal(second.body.next, null);
    assert.equal((await http().get("/api/facilities/").query({ page: 9 }).set(as(fm.token))).status, 404);
  });
});

describe("credential AI reading", () => {
  before(start);
  after(stop);
  beforeEach(reset);
  after(() => setExtractor(null));

  const PDF = Buffer.from("%PDF-1.4\n%%EOF");
  const extract = (token, file = PDF, name = "card.pdf") =>
    http().post("/api/credentials/extract/").set(as(token)).attach("file", file, { filename: name });

  it("is unavailable until a key is configured, and never accepts non-credential file types", async () => {
    setExtractor(null);
    const tech = await makeTechnician(null);
    const off = await extract(tech.token);
    assert.equal(off.status, 503);
    assert.match(off.body.detail, /isn't configured/);

    const exe = await extract(tech.token, Buffer.from("MZ\x90\x00binary"), "run.pdf");
    assert.equal(exe.status, 400);
    assert.match(exe.body.detail, /PDF or a JPEG/);
  });

  it("is for technicians only, and returns what the reader found without saving anything", async () => {
    setExtractor(async () => ({
      is_credential_document: true, holder_name: "Arjun Senior", credential_name: "EPA 608", issuer_name: "EPA",
      credential_number: "C-100", issue_date: "2024-01-01", expiry_date: "2030-01-01", notes: null,
    }));
    const tech = await makeTechnician(null);
    const fm = await makeUser("facility_manager");
    assert.equal((await extract(fm.token)).status, 403);

    const ok = await extract(tech.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.holder_name, "Arjun Senior");
    assert.equal(await models.Credential.countDocuments(), 0);
  });

  it("compares the reading with the account and the typed fields", async () => {
    const { compareExtraction } = await import("../src/services/ocr.js");
    const reading = {
      is_credential_document: true, holder_name: "Priya Sharma", credential_name: "EPA 608", issuer_name: "Environmental Protection Agency",
      credential_number: "608-99", issue_date: "2024-01-01", expiry_date: "2020-06-30", notes: null,
    };
    const typed = { credential_number: "608-12", issuer_name: "EPA", expiry_date: "2031-01-01" };

    const codes = compareExtraction(reading, typed, "Arjun Senior", "2026-10-14").map((f) => f.code);
    assert.deepEqual(codes, ["holder_name_mismatch", "number_mismatch", "document_expired", "expiry_mismatch"]);

    // an acronym vs the full name, and a middle name, are not mismatches
    const fine = compareExtraction(
      { ...reading, holder_name: "Priya Kumari Sharma", credential_number: "608-12", expiry_date: "2031-01-01" },
      typed, "Priya Sharma", "2026-10-14"
    );
    assert.deepEqual(fine, []);

    const notCard = compareExtraction({ ...reading, is_credential_document: false }, typed, "Priya Sharma");
    assert.deepEqual(notCard.map((f) => f.code), ["not_a_credential"]);
  });

  it("lets admins run a stored-document check and keeps the result admin-only", async () => {
    const admin = await makeUser("admin");
    const tech = await makeTechnician(null);
    const upload = await http()
      .post("/api/credentials/").set(as(tech.token))
      .field("technician", String(tech.profile._id)).field("name", "EPA 608").field("issuer_name", "EPA").field("credential_number", "C-1")
      .attach("file", PDF, { filename: "card.pdf" });
    const id = upload.body.id;

    setExtractor(async () => ({
      is_credential_document: true, holder_name: "Someone Else", credential_name: "EPA 608", issuer_name: "EPA",
      credential_number: "C-1", issue_date: null, expiry_date: null, notes: null,
    }));
    assert.equal((await http().post(`/api/credentials/${id}/ai-check/`).set(as(tech.token))).status, 403);

    const ok = await http().post(`/api/credentials/${id}/ai-check/`).set(as(admin.token));
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.ai_check.flags.map((f) => f.code), ["holder_name_mismatch"]);
    assert.ok(await models.AuditLog.findOne({ action: "credential.ai_check" }));

    const asTechnician = await http().get(`/api/credentials/${id}/`).set(as(tech.token));
    assert.equal(asTechnician.body.ai_check, undefined);
  });
});

describe("rate limiting", () => {
  before(start);
  after(stop);

  it("answers 429 with a retry hint once a budget is spent", async () => {
    const express = (await import("express")).default;
    const supertest = (await import("supertest")).default;
    const { limiter } = await import("../src/middleware/throttle.js");
    const app = express();
    app.get("/limited", limiter("password_reset", { limit: 2 }), (_req, res) => res.json({ ok: true }));

    const agent = supertest(app);
    assert.equal((await agent.get("/limited")).status, 200);
    assert.equal((await agent.get("/limited")).status, 200);
    const blocked = await agent.get("/limited");
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.detail, /Request was throttled\. Expected available in \d+ seconds\./);
  });
});

describe("onboarding links", () => {
  before(start);
  after(stop);
  beforeEach(reset);

  it("point straight at the form that completes each step", async () => {
    const tech = await makeTechnician(null);
    const techLinks = (await http().get("/api/onboarding/").set(as(tech.token))).body.steps.map((s) => s.link);
    assert.deepEqual(techLinks, ["/profile?add=1", "/credentials?add=1", "/capabilities?add=1", "/assessments", "/my-jobs"]);

    const fm = await makeUser("facility_manager");
    const before = (await http().get("/api/onboarding/").set(as(fm.token))).body.steps.map((s) => s.link);
    assert.deepEqual(before, ["/facilities?add=1", "/facilities?add=1", "/jobs/new", "/jobs"]);

    await makeFacility(fm.user);
    const after = (await http().get("/api/onboarding/").set(as(fm.token))).body.steps;
    assert.equal(after[1].link, "/equipment?add=1", "equipment has its own section once a facility exists");

    const contractor = await makeUser("contractor_manager");
    const contractorLinks = (await http().get("/api/onboarding/").set(as(contractor.token))).body.steps.map((s) => s.link);
    assert.deepEqual(contractorLinks, ["/company", "/company?add=1", "/roster?add=1", "/cylinders?add=1"]);
  });

  it("ticks a step the moment the work exists", async () => {
    const tech = await makeTechnician(null);
    const done = async () => (await http().get("/api/onboarding/").set(as(tech.token))).body.steps.find((s) => s.id === "capability").done;
    assert.equal(await done(), false);
    const res = await http().post("/api/capabilities/").set(as(tech.token)).send({
      technician: tech.profile._id, capability_type: "safety", safety_domain: "leak_detection",
    });
    assert.equal(res.status, 201);
    assert.equal(await done(), true);
  });
});
