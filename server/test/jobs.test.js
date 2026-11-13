import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  as, http, makeContractor, makeEquipment, makeFacility, makeJob, makeRefrigerants, makeTechnician, makeUser, models,
  reset, start, stop, verifiedSkill,
} from "./helpers.js";

let fm, r, facility;

async function world() {
  fm = await makeUser("facility_manager");
  r = await makeRefrigerants();
  facility = await makeFacility(fm.user);
}

const ammoniaUnit = (overrides = {}) =>
  makeEquipment(facility, r.r717, { name: "Ammonia plant", category: "ammonia_system", criticality: "high", ...overrides });

async function qualify(technician, { equipment = "ammonia_system" } = {}) {
  await verifiedSkill(technician, { capability_type: "equipment", equipment_category: equipment });
  await verifiedSkill(technician, { capability_type: "refrigerant", refrigerant_type: r.r717._id });
  await verifiedSkill(technician, { capability_type: "safety", safety_domain: "ammonia_safety" });
  await verifiedSkill(technician, { capability_type: "safety", safety_domain: "refrigerant_recovery" });
}

describe("job requests", () => {
  before(start);
  after(stop);
  beforeEach(async () => {
    await reset();
    await world();
  });

  it("classifies risk and required capabilities when a job is raised", async () => {
    const unit = await ammoniaUnit();
    const res = await http()
      .post("/api/jobs/")
      .set(as(fm.token))
      .send({ facility: facility._id, equipment: unit._id, description: "Pressure alarm", urgency: "scheduled" });
    assert.equal(res.status, 201);
    assert.equal(res.body.risk_level, "high"); // high 3 + ammonia 4 + scheduled 1 = 8
    assert.equal(res.body.status, "open");
    assert.equal(res.body.created_by, fm.user._id);

    const keys = res.body.required_capabilities.map((c) => `${c.capability_type}:${c.key}`);
    assert.deepEqual(keys, [
      "equipment:ammonia_system", `refrigerant:${r.r717._id}`, "safety:ammonia_safety", "safety:refrigerant_recovery",
    ]);
  });

  it("escalates urgency into a higher band", async () => {
    const unit = await ammoniaUnit({ criticality: "critical" });
    const res = await http()
      .post("/api/jobs/")
      .set(as(fm.token))
      .send({ facility: facility._id, equipment: unit._id, description: "Leak", urgency: "emergency" });
    assert.equal(res.body.risk_level, "critical"); // 4 + 4 + 3 = 11
  });

  it("keeps a low-risk job to its two basic requirements", async () => {
    const unit = await makeEquipment(facility, r.r134a, { criticality: "low" });
    const res = await http()
      .post("/api/jobs/")
      .set(as(fm.token))
      .send({ facility: facility._id, equipment: unit._id, description: "Check", urgency: "routine" });
    assert.equal(res.body.risk_level, "low");
    assert.equal(res.body.required_capabilities.length, 2);
  });

  it("will not raise a job on someone else's facility or with mismatched equipment", async () => {
    const other = await makeUser("facility_manager");
    const theirFacility = await makeFacility(other.user, { name: "Theirs" });
    const theirUnit = await makeEquipment(theirFacility, r.r134a);
    const mine = await makeEquipment(facility, r.r134a);

    const foreign = await http()
      .post("/api/jobs/")
      .set(as(fm.token))
      .send({ facility: theirFacility._id, equipment: theirUnit._id, description: "x" });
    assert.equal(foreign.status, 403);

    const mismatched = await http()
      .post("/api/jobs/")
      .set(as(fm.token))
      .send({ facility: facility._id, equipment: theirUnit._id, description: "x" });
    assert.equal(mismatched.status, 400);
    assert.ok(mismatched.body.equipment);

    const ok = await http().post("/api/jobs/").set(as(fm.token)).send({ facility: facility._id, equipment: mine._id, description: "x" });
    assert.equal(ok.status, 201);
  });

  it("scopes visibility by role", async () => {
    const unit = await makeEquipment(facility, r.r134a);
    const job = await makeJob(facility, unit, fm.user);
    const contractorUser = await makeUser("contractor_manager");
    const company = await makeContractor(contractorUser.user);
    const assigned = await makeTechnician(company);
    const stranger = await makeTechnician(null);
    const otherContractor = await makeUser("contractor_manager");
    await makeContractor(otherContractor.user, { name: "Other" });
    await models.JobAssignment.create({ job: job._id, technician: assigned.profile._id, assigned_by: fm.user._id });

    const otherFm = await makeUser("facility_manager");
    const results = {
      owner: await http().get(`/api/jobs/${job._id}/`).set(as(fm.token)),
      otherFm: await http().get(`/api/jobs/${job._id}/`).set(as(otherFm.token)),
      assigned: await http().get(`/api/jobs/${job._id}/`).set(as(assigned.token)),
      stranger: await http().get(`/api/jobs/${job._id}/`).set(as(stranger.token)),
      contractor: await http().get(`/api/jobs/${job._id}/`).set(as(contractorUser.token)),
      otherContractor: await http().get(`/api/jobs/${job._id}/`).set(as(otherContractor.token)),
    };
    assert.deepEqual(
      Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])),
      { owner: 200, otherFm: 404, assigned: 200, stranger: 404, contractor: 200, otherContractor: 404 }
    );
    assert.equal(results.owner.body.assignment.technician, assigned.profile._id);
  });

  it("lists with pagination metadata and filters by schedule window", async () => {
    const unit = await makeEquipment(facility, r.r134a);
    const day = (n) => new Date(Date.UTC(2026, 9, n, 9));
    await makeJob(facility, unit, fm.user, { scheduled_for: day(5) });
    await makeJob(facility, unit, fm.user, { scheduled_for: day(15) });
    await makeJob(facility, unit, fm.user, { scheduled_for: null });

    const all = await http().get("/api/jobs/").set(as(fm.token));
    assert.equal(all.body.count, 3);
    assert.equal(all.body.next, null);
    assert.equal(all.body.previous, null);

    const window = await http()
      .get("/api/jobs/")
      .query({ scheduled_for__gte: day(10).toISOString(), scheduled_for__lte: day(20).toISOString() })
      .set(as(fm.token));
    assert.equal(window.body.count, 1);
  });

  it("only lets the facility manager change a job", async () => {
    const unit = await makeEquipment(facility, r.r134a);
    const job = await makeJob(facility, unit, fm.user);
    const tech = await makeTechnician(null);
    await models.JobAssignment.create({ job: job._id, technician: tech.profile._id, assigned_by: fm.user._id });

    const byTech = await http().patch(`/api/jobs/${job._id}/`).set(as(tech.token)).send({ description: "hacked" });
    assert.equal(byTech.status, 403);

    const when = "2026-11-02T10:00:00Z";
    const byOwner = await http().patch(`/api/jobs/${job._id}/`).set(as(fm.token)).send({ scheduled_for: when });
    assert.equal(byOwner.status, 200);
    assert.equal(byOwner.body.scheduled_for, "2026-11-02T10:00:00.000Z");
  });
});

describe("assignment guard and matching", () => {
  before(start);
  after(stop);
  beforeEach(async () => {
    await reset();
    await world();
  });

  const highRiskJob = async () => {
    const unit = await ammoniaUnit();
    const res = await http()
      .post("/api/jobs/")
      .set(as(fm.token))
      .send({ facility: facility._id, equipment: unit._id, description: "Alarm", urgency: "scheduled" });
    return res.body;
  };
  const assign = (job, body) => http().post(`/api/jobs/${job.id}/assign/`).set(as(fm.token)).send(body);

  it("blocks an under-qualified technician on a high-risk job", async () => {
    const job = await highRiskJob();
    const tech = await makeTechnician(null);
    const res = await assign(job, { technician_id: tech.profile._id });
    assert.equal(res.status, 409);
    assert.equal(res.body.requires_override, true);
    assert.ok(res.body.missing_requirements.length > 0);
    assert.equal(await models.JobAssignment.countDocuments(), 0);
  });

  it("requires a reason to override, then flags the assignment", async () => {
    const job = await highRiskJob();
    const tech = await makeTechnician(null);

    const noReason = await assign(job, { technician_id: tech.profile._id, override_warning: true });
    assert.equal(noReason.status, 400);

    const ok = await assign(job, { technician_id: tech.profile._id, override_warning: true, override_reason: "Only one available" });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.override_warning, true);
    assert.equal(ok.body.override_reason, "Only one available");

    const stored = await models.JobRequest.findById(job.id).lean();
    assert.equal(stored.status, "assigned");
  });

  it("assigns a qualified technician cleanly, notifies them and writes the audit trail", async () => {
    const job = await highRiskJob();
    const tech = await makeTechnician(null);
    await qualify(tech.profile);

    const res = await assign(job, { technician_id: tech.profile._id });
    assert.equal(res.status, 201);
    assert.equal(res.body.override_warning, false);
    assert.equal(res.body.technician_name, `${tech.user.first_name} ${tech.user.last_name}`);

    const note = await models.Notification.findOne({ user: tech.user._id }).lean();
    assert.equal(note.title, "New job assigned");
    assert.equal(note.link, `/my-jobs/${job.id}/report`);

    const audit = await models.AuditLog.findOne({ action: "job.assign" }).lean();
    assert.equal(audit.metadata.technician_id, tech.profile._id);
  });

  it("will not assign a job twice or to a missing technician", async () => {
    const job = await highRiskJob();
    const tech = await makeTechnician(null);
    await qualify(tech.profile);

    assert.equal((await assign(job, { technician_id: 99999 })).status, 404);
    assert.equal((await assign(job, { technician_id: tech.profile._id })).status, 201);
    assert.equal((await assign(job, { technician_id: tech.profile._id })).status, 400);
  });

  it("ranks the qualified technician first and lists what the others lack", async () => {
    const job = await highRiskJob();
    const strong = await makeTechnician(null, { years_experience: 3 });
    await qualify(strong.profile);
    const weak = await makeTechnician(null, { years_experience: 9 });
    const unavailable = await makeTechnician(null, { available: false });
    await qualify(unavailable.profile);

    const res = await http().get(`/api/jobs/${job.id}/matches/`).set(as(fm.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2, "unavailable technicians are excluded");
    assert.equal(res.body[0].technician_id, strong.profile._id);
    assert.equal(res.body[0].is_qualified, true);
    assert.equal(res.body[1].technician_id, weak.profile._id);
    assert.equal(res.body[1].is_qualified, false);
    assert.equal(res.body[1].missing_requirements.length, 4);
    assert.equal(res.body[0].breakdown.capability_score, 80);
  });

  it("scores pending capabilities lower than verified ones, plus location and verified-contractor bonuses", async () => {
    const job = await highRiskJob();
    const company = await makeContractor((await makeUser("contractor_manager")).user);
    const tech = await makeTechnician(company, { years_experience: 4, service_area: " TESTVILLE " });
    await verifiedSkill(tech.profile, { capability_type: "equipment", equipment_category: "ammonia_system", status: "pending" });
    await models.WorkHistoryEntry.create({
      technician: tech.profile._id, equipment_category: "ammonia_system", description: "Prior job", date: "2026-01-01",
    });

    const res = await http().get(`/api/jobs/${job.id}/matches/`).set(as(fm.token));
    const entry = res.body.find((m) => m.technician_id === tech.profile._id);
    assert.deepEqual(entry.breakdown, {
      capability_score: 5, work_history_score: 2, experience_score: 4, location_score: 10, contractor_score: 10,
    });
    assert.equal(entry.score, 31);
    assert.equal(entry.contractor, "Test Contractor");
  });
});

describe("ratings", () => {
  before(start);
  after(stop);
  beforeEach(async () => {
    await reset();
    await world();
  });

  async function completedJob() {
    const unit = await makeEquipment(facility, r.r134a);
    const job = await makeJob(facility, unit, fm.user, { status: "completed" });
    const tech = await makeTechnician(null);
    await models.JobAssignment.create({ job: job._id, technician: tech.profile._id, assigned_by: fm.user._id });
    return { job, tech };
  }

  it("lets the owning manager rate a completed job once and updates the technician's average", async () => {
    const { job, tech } = await completedJob();
    const res = await http().post(`/api/jobs/${job._id}/feedback/`).set(as(fm.token)).send({ rating: 4, comment: "Tidy work" });
    assert.equal(res.status, 201);
    assert.equal(res.body.rating, 4);

    const twice = await http().post(`/api/jobs/${job._id}/feedback/`).set(as(fm.token)).send({ rating: 5 });
    assert.equal(twice.status, 409);

    const profile = await http().get(`/api/technicians/${tech.profile._id}/`).set(as(fm.token));
    assert.equal(profile.body.average_rating, 4);
    assert.equal(profile.body.rating_count, 1);

    const notification = await models.Notification.findOne({ user: tech.user._id }).lean();
    assert.equal(notification.title, "You were rated 4/5");

    const job2 = await http().get(`/api/jobs/${job._id}/`).set(as(fm.token));
    assert.equal(job2.body.feedback.rating, 4);
  });

  it("rejects out-of-range ratings, open jobs and other managers", async () => {
    const { job } = await completedJob();
    const bad = await http().post(`/api/jobs/${job._id}/feedback/`).set(as(fm.token)).send({ rating: 6 });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.rating, ["Rating must be between 1 and 5."]);

    const other = await makeUser("facility_manager");
    assert.equal((await http().post(`/api/jobs/${job._id}/feedback/`).set(as(other.token)).send({ rating: 3 })).status, 404);

    await models.JobRequest.updateOne({ _id: job._id }, { status: "assigned" });
    const open = await http().post(`/api/jobs/${job._id}/feedback/`).set(as(fm.token)).send({ rating: 3 });
    assert.equal(open.status, 400);
  });
});
