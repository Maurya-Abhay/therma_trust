import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  as, dec, http, makeContractor, makeEquipment, makeFacility, makeJob, makeRefrigerants, makeTechnician, makeUser, models,
  reset, start, stop,
} from "./helpers.js";

let fm, manager, company, tech, r, facility, unit, job;

async function world() {
  fm = await makeUser("facility_manager");
  manager = await makeUser("contractor_manager");
  company = await makeContractor(manager.user);
  tech = await makeTechnician(company);
  r = await makeRefrigerants();
  facility = await makeFacility(fm.user);
  unit = await makeEquipment(facility, r.r134a, { refrigerant_charge_kg: dec(100) });
  job = await makeJob(facility, unit, fm.user, { status: "assigned" });
  await models.JobAssignment.create({ job: job._id, technician: tech.profile._id, assigned_by: fm.user._id });
}

const cylinder = (fields) =>
  models.RefrigerantCylinder.create({
    company: company._id, serial_number: "CYL-1", refrigerant_type: r.r134a._id, kind: "supply",
    capacity_kg: dec(50), current_kg: dec(20), ...fields,
  });

const submit = (token, body, jobId = job._id) =>
  http().post("/api/service-reports/").set(as(token)).send({
    job: jobId, fault_description: "Compressor tripping", refrigerant_type: r.r134a._id, summary: "Fixed", ...body,
  });

const kg = async (id) => Number((await models.RefrigerantCylinder.findById(id).lean()).current_kg.toString());

describe("service reports", () => {
  before(start);
  after(stop);
  beforeEach(async () => {
    await reset();
    await world();
  });

  it("is submitted by the assigned technician, signed, and moves the job to in progress", async () => {
    const res = await submit(tech.token, { refrigerant_added_kg: "2.50", diagnostic_readings: { superheat: "8" } });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "submitted");
    assert.equal(res.body.refrigerant_added_kg, "2.50");
    assert.equal(res.body.refrigerant_recovered_kg, "0.00");
    assert.equal(res.body.refrigerant_code, "R-134a");
    assert.ok(res.body.technician_signed_at);
    assert.deepEqual(res.body.photos, []);
    assert.equal((await models.JobRequest.findById(job._id).lean()).status, "in_progress");
  });

  it("is refused for a technician who is not assigned, for non-technicians, and a second time", async () => {
    const other = await makeTechnician(company);
    assert.equal((await submit(other.token, {})).status, 403);
    assert.equal((await submit(fm.token, {})).status, 403);

    assert.equal((await submit(tech.token, {})).status, 201);
    const again = await submit(tech.token, {});
    assert.equal(again.status, 400);
    assert.deepEqual(again.body.job, ["service report with this job already exists."]);
  });

  it("validates amounts the way the form expects", async () => {
    const res = await submit(tech.token, { refrigerant_added_kg: "abc", refrigerant_recovered_kg: "1.234" });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.refrigerant_added_kg, ["A valid number is required."]);
    assert.deepEqual(res.body.refrigerant_recovered_kg, ["Ensure that there are no more than 2 decimal places."]);
  });

  it("is approved by the owning manager, which completes the job and notifies the technician", async () => {
    const report = (await submit(tech.token, {})).body;
    const stranger = await makeUser("facility_manager");
    assert.equal((await http().post(`/api/service-reports/${report.id}/approve/`).set(as(stranger.token))).status, 404);
    assert.equal((await http().post(`/api/service-reports/${report.id}/approve/`).set(as(tech.token))).status, 403);

    const ok = await http().post(`/api/service-reports/${report.id}/approve/`).set(as(fm.token));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, "approved");
    assert.equal(ok.body.facility_approved_by, fm.user._id);
    assert.equal((await models.JobRequest.findById(job._id).lean()).status, "completed");

    const note = await models.Notification.findOne({ user: tech.user._id, title: "Report approved" }).lean();
    assert.equal(note.link, `/my-jobs/${job._id}/report`);
  });

  it("can be sent back for changes without completing the job", async () => {
    const report = (await submit(tech.token, {})).body;
    const res = await http().post(`/api/service-reports/${report.id}/reject/`).set(as(fm.token));
    assert.equal(res.body.status, "rejected");
    assert.notEqual((await models.JobRequest.findById(job._id).lean()).status, "completed");
    assert.ok(await models.Notification.findOne({ user: tech.user._id, title: "Report needs changes" }));
  });

  it("renders a PDF for the people who may see the report", async () => {
    const report = (await submit(tech.token, { summary: "Replaced contactor" })).body;
    const binary = (res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    };
    const ok = await http().get(`/api/service-reports/${report.id}/pdf/`).set(as(fm.token)).buffer(true).parse(binary);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.subarray(0, 4).toString(), "%PDF");
    assert.match(ok.headers["content-disposition"], /service-report-job-\d+\.pdf/);

    const stranger = await makeUser("facility_manager");
    assert.equal((await http().get(`/api/service-reports/${report.id}/pdf/`).set(as(stranger.token))).status, 404);
  });

  it("only the author can edit it", async () => {
    const report = (await submit(tech.token, {})).body;
    assert.equal((await http().patch(`/api/service-reports/${report.id}/`).set(as(fm.token)).send({ summary: "x" })).status, 403);
    const ok = await http().patch(`/api/service-reports/${report.id}/`).set(as(tech.token)).send({ summary: "Better summary" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.summary, "Better summary");
  });

  it("accepts image uploads from the author only, and rejects non-images", async () => {
    const report = (await submit(tech.token, {})).body;
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
    const send = (token, file, name = "before.png") =>
      http().post("/api/service-report-photos/").set(as(token)).field("report", String(report.id)).field("caption", "Gauge")
        .attach("image", file, { filename: name });

    assert.equal((await send(fm.token, PNG)).status, 403);
    assert.equal((await send(tech.token, Buffer.from("<script>alert(1)</script>"), "x.png")).status, 400);
    const ok = await send(tech.token, PNG);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.is_before, true);

    const detail = await http().get(`/api/service-reports/${report.id}/`).set(as(fm.token));
    assert.equal(detail.body.photos.length, 1);
  });

  it("does not let a ?technician= parameter reveal another technician's reports", async () => {
    await submit(tech.token, {});
    const intruder = await makeTechnician(company);
    const res = await http().get("/api/service-reports/").query({ technician: tech.profile._id }).set(as(intruder.token));
    assert.equal(res.body.count, 0);
  });
});

describe("cylinder custody", () => {
  before(start);
  after(stop);
  beforeEach(async () => {
    await reset();
    await world();
  });

  it("registers with an initial fill and a ledger line, audited", async () => {
    const res = await http().post("/api/cylinders/").set(as(manager.token)).send({
      company: company._id, serial_number: "NEW-1", refrigerant_type: r.r134a._id, kind: "supply", capacity_kg: "30.00", current_kg: "12.50",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.current_kg, "12.50");
    assert.equal(res.body.refrigerant_type_code, "R-134a");

    const history = await http().get(`/api/cylinders/${res.body.id}/history/`).set(as(manager.token));
    assert.equal(history.body.length, 1);
    assert.equal(history.body[0].kind, "initial_fill");
    assert.equal(history.body[0].amount_kg, "12.50");
    assert.ok(await models.AuditLog.findOne({ action: "cylinder.register" }));
  });

  it("refuses bad starting values, duplicates, technicians and other companies' managers", async () => {
    const body = { company: company._id, serial_number: "S-1", refrigerant_type: r.r134a._id, capacity_kg: "10.00", current_kg: "0.00" };
    const over = await http().post("/api/cylinders/").set(as(manager.token)).send({ ...body, current_kg: "11.00" });
    assert.equal(over.status, 400);
    assert.ok(over.body.current_kg);
    assert.equal((await http().post("/api/cylinders/").set(as(manager.token)).send({ ...body, capacity_kg: "0" })).status, 400);

    assert.equal((await http().post("/api/cylinders/").set(as(tech.token)).send(body)).status, 403);
    const other = await makeUser("contractor_manager");
    assert.equal((await http().post("/api/cylinders/").set(as(other.token)).send(body)).status, 403);

    assert.equal((await http().post("/api/cylinders/").set(as(manager.token)).send(body)).status, 201);
    const dup = await http().post("/api/cylinders/").set(as(manager.token)).send(body);
    assert.equal(dup.status, 400);
  });

  it("draws down a supply cylinder and writes a ledger line tied to the report", async () => {
    const supply = await cylinder({});
    const res = await submit(tech.token, { refrigerant_added_kg: "4.50", added_from_cylinder: supply._id });
    assert.equal(res.status, 201);
    assert.equal(res.body.added_from_cylinder_serial, "CYL-1");
    assert.equal(await kg(supply._id), 15.5);

    const rows = await models.CylinderTransaction.find({ cylinder: supply._id }).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "draw");
    assert.equal(rows[0].service_report, res.body.id);
    assert.equal(rows[0].balance_after_kg.toString(), "15.50");
    assert.ok(await models.AuditLog.findOne({ action: "cylinder.draw" }));
  });

  it("fills a recovery cylinder", async () => {
    const recovery = await cylinder({ serial_number: "REC-1", kind: "recovery", current_kg: dec(1) });
    const res = await submit(tech.token, { refrigerant_recovered_kg: "3.00", recovered_into_cylinder: recovery._id });
    assert.equal(res.status, 201);
    assert.equal(await kg(recovery._id), 4);
  });

  it("will not draw more than the cylinder holds, mix refrigerants, or swap kinds", async () => {
    const supply = await cylinder({});
    const tooMuch = await submit(tech.token, { refrigerant_added_kg: "25.00", added_from_cylinder: supply._id });
    assert.equal(tooMuch.status, 400);
    assert.match(tooMuch.body.added_from_cylinder[0], /only has 20\.00 kg left/);

    const wrongGas = await submit(tech.token, { refrigerant_type: r.r32._id, refrigerant_added_kg: "1.00", added_from_cylinder: supply._id });
    assert.match(wrongGas.body.added_from_cylinder[0], /holds R-134a, not R-32/);

    const recovery = await cylinder({ serial_number: "REC-2", kind: "recovery", current_kg: dec(0) });
    const wrongKind = await submit(tech.token, { refrigerant_added_kg: "1.00", added_from_cylinder: recovery._id });
    assert.match(wrongKind.body.added_from_cylinder[0], /not a supply cylinder/);

    assert.equal(await kg(supply._id), 20);
    assert.equal(await models.ServiceReport.countDocuments(), 0, "nothing is left behind by a rejected submission");
  });

  it("will not overfill a recovery cylinder or log a zero amount", async () => {
    const recovery = await cylinder({ serial_number: "REC-3", kind: "recovery", capacity_kg: dec(10), current_kg: dec(8) });
    const over = await submit(tech.token, { refrigerant_recovered_kg: "5.00", recovered_into_cylinder: recovery._id });
    assert.match(over.body.recovered_into_cylinder[0], /only has 2\.00 kg of free space/);

    const zero = await submit(tech.token, { refrigerant_recovered_kg: "0", recovered_into_cylinder: recovery._id });
    assert.match(zero.body.recovered_into_cylinder[0], /greater than 0/);
  });

  it("will not use another company's cylinder", async () => {
    const otherManager = await makeUser("contractor_manager");
    const otherCompany = await makeContractor(otherManager.user, { name: "Other Co" });
    const foreign = await cylinder({ company: otherCompany._id, serial_number: "THEIRS" });
    const res = await submit(tech.token, { refrigerant_added_kg: "1.00", added_from_cylinder: foreign._id });
    assert.equal(res.status, 400);
    assert.match(res.body.added_from_cylinder[0], /does not belong to your company/);
  });

  it("locks logged amounts and cylinders once refrigerant was drawn", async () => {
    const supply = await cylinder({});
    const report = (await submit(tech.token, { refrigerant_added_kg: "2.00", added_from_cylinder: supply._id })).body;
    const edit = await http().patch(`/api/service-reports/${report.id}/`).set(as(tech.token)).send({ refrigerant_added_kg: "9.00" });
    assert.equal(edit.status, 400);
    assert.ok(edit.body.refrigerant_added_kg);
    const swap = await http().patch(`/api/service-reports/${report.id}/`).set(as(tech.token)).send({ added_from_cylinder: null });
    assert.equal(swap.status, 400);
    assert.equal(await kg(supply._id), 18);
  });

  it("never lets two simultaneous draws overdraw a cylinder", async () => {
    const supply = await cylinder({ current_kg: dec(5) });
    const second = await makeTechnician(company);
    const job2 = await makeJob(facility, unit, fm.user, { status: "assigned" });
    await models.JobAssignment.create({ job: job2._id, technician: second.profile._id, assigned_by: fm.user._id });

    const results = await Promise.all([
      submit(tech.token, { refrigerant_added_kg: "4.00", added_from_cylinder: supply._id }),
      submit(second.token, { refrigerant_added_kg: "4.00", added_from_cylinder: supply._id }, job2._id),
    ]);
    const statuses = results.map((x) => x.status).sort();
    assert.deepEqual(statuses, [201, 400]);
    assert.equal(await kg(supply._id), 1);
  });

  it("limits who sees which cylinders", async () => {
    const supply = await cylinder({});
    const otherManager = await makeUser("contractor_manager");
    await makeContractor(otherManager.user, { name: "Other Co" });
    const outsider = await makeTechnician(null);

    const own = await http().get("/api/cylinders/").set(as(tech.token));
    assert.equal(own.body.count, 1);
    assert.equal((await http().get("/api/cylinders/").set(as(outsider.token))).body.count, 0);
    assert.equal((await http().get("/api/cylinders/").set(as(otherManager.token))).body.count, 0);
    assert.equal((await http().get("/api/cylinders/").set(as(fm.token))).body.count, 0);
    assert.equal((await http().get(`/api/cylinders/${supply._id}/`).set(as(otherManager.token))).status, 404);
  });
});

describe("leak rate, drift and the refrigerant dashboard", () => {
  before(start);
  after(stop);
  beforeEach(async () => {
    await reset();
    await world();
  });

  const reportOn = async (equipment, fields = {}) => {
    const j = await makeJob(facility, equipment, fm.user, { status: "in_progress" });
    return models.ServiceReport.create({
      job: j._id, technician: tech.profile._id, fault_description: "x", refrigerant_type: r.r134a._id,
      refrigerant_added_kg: dec(0), refrigerant_recovered_kg: dec(0), ...fields,
    });
  };

  it("computes the rolling 12-month leak rate against the charge", async () => {
    await reportOn(unit, { refrigerant_added_kg: dec(25) });
    await reportOn(unit, { refrigerant_added_kg: dec(10), created_at: new Date(Date.now() - 400 * 86_400_000) });

    const res = await http().get(`/api/equipment/${unit._id}/history/`).set(as(fm.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.leak_rate.added_kg_12mo, 25);
    assert.equal(res.body.leak_rate.leak_rate_percent, 25);
    assert.equal(res.body.leak_rate.exceeds_threshold, true);
    assert.equal(res.body.leak_rate.charge_kg, 100);
    assert.equal(res.body.reports.length, 2);
  });

  it("says why a leak rate cannot be calculated without a recorded charge", async () => {
    const bare = await makeEquipment(facility, r.r134a, { name: "No charge" });
    const res = await http().get(`/api/equipment/${bare._id}/history/`).set(as(fm.token));
    assert.equal(res.body.leak_rate.leak_rate_percent, null);
    assert.match(res.body.leak_rate.note, /cannot be calculated/);
  });

  it("flags a metric that moves the same way across the last three services", async () => {
    for (const value of ["8", "10", "13"]) {
      await reportOn(unit, { diagnostic_readings: { Superheat: `${value} K`, amps: 12 }, created_at: new Date(Date.now() - (14 - Number(value)) * 3600_000) });
    }
    const res = await http().get(`/api/equipment/${unit._id}/`).set(as(fm.token));
    assert.deepEqual(res.body.drift_warnings, [{ metric: "superheat", values: [8, 10, 13], direction: "increasing" }]);
  });

  it("needs three services before calling a trend", async () => {
    await reportOn(unit, { diagnostic_readings: { superheat: 5 } });
    await reportOn(unit, { diagnostic_readings: { superheat: 9 } });
    const res = await http().get(`/api/equipment/${unit._id}/`).set(as(fm.token));
    assert.deepEqual(res.body.drift_warnings, []);
  });

  it("summarises refrigerant, estimates CO2e and returns a gap-free monthly series", async () => {
    await reportOn(unit, { refrigerant_added_kg: dec(10), refrigerant_recovered_kg: dec(4) });
    const res = await http().get("/api/dashboard/refrigerant-summary/").set(as(fm.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.total_added_kg, 10);
    assert.equal(res.body.total_recovered_kg, 4);
    assert.equal(res.body.leaked_estimate_kg, 6);
    assert.equal(res.body.co2e_estimate_kg, 8580); // 6 kg * 1430
    assert.deepEqual(res.body.by_refrigerant, { "R-134a": { added_kg: 10, recovered_kg: 4, leaked_estimate_kg: 6 } });
    assert.equal(res.body.report_count, 1);
    assert.equal(res.body.monthly.length, 12);
    assert.equal(res.body.monthly.at(-1).added_kg, 10);
    assert.equal(res.body.leak_rate_by_equipment[0].equipment_name, "Chiller 1");
    assert.equal(res.body.leak_rate_by_equipment[0].facility_name, "Test Facility");
  });

  it("is scoped to the viewer, and exports the same rows as CSV", async () => {
    await reportOn(unit, { refrigerant_added_kg: dec(30) });
    const stranger = await makeUser("facility_manager");
    assert.equal((await http().get("/api/dashboard/refrigerant-summary/").set(as(stranger.token))).body.report_count, 0);

    const csv = await http().get("/api/dashboard/refrigerant-summary/export/").set(as(fm.token));
    assert.equal(csv.status, 200);
    assert.match(csv.headers["content-type"], /text\/csv/);
    const lines = csv.text.trim().split("\r\n");
    assert.equal(lines[0], "Equipment,Facility,Charge (kg),Added in last 12mo (kg),Leak Rate %,Threshold %,Exceeds Threshold,Note");
    assert.equal(lines[1], "Chiller 1,Test Facility,100.0,30.0,30.0,20.0,True,");
  });
});
