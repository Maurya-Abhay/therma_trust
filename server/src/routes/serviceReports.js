import { Router } from "express";
import * as C from "../lib/choices.js";
import { dec, num, round2 } from "../lib/decimal.js";
import { ApiError, forbidden, validationError } from "../lib/errors.js";
import { getScoped, sendPdf } from "../lib/http.js";
import { allOf, filtersFrom, paginate } from "../lib/pagination.js";
import { validateBody } from "../lib/validate.js";
import { authenticate } from "../middleware/auth.js";
import { MAX_FILE_BYTES, multipart, storeUpload } from "../middleware/upload.js";
import {
  ContractorCompany, CylinderTransaction, Equipment, Facility, JobAssignment, JobRequest, RefrigerantCylinder,
  RefrigerantType, ServiceReport, ServiceReportPhoto, TechnicianProfile, User, byId, fullNameOf, isAdmin,
} from "../models/index.js";
import {
  presentCylinders, presentReportPhotos, presentReports, presentTransactions,
} from "../presenters.js";
import { recordAudit } from "../services/audit.js";
import { applyCylinderMovements, validateCylinderUse } from "../services/cylinders.js";
import { renderServiceReport } from "../services/documents.js";
import { computeLeakRates } from "../services/leakRate.js";
import { notify } from "../services/notify.js";
import { detectMediaType } from "../services/ocr.js";

const router = Router();
for (const prefix of ["/service-reports", "/service-report-photos", "/cylinders", "/dashboard"]) router.use(prefix, authenticate);

const REPORT_SPEC = {
  job: { type: "fk", required: true },
  fault_description: { type: "string", required: true },
  diagnostic_readings: { type: "json", default: () => ({}) },
  refrigerant_type: { type: "fk", required: true },
  refrigerant_added_kg: { type: "decimal", maxDigits: 6, decimalPlaces: 2, min: 0, default: 0 },
  refrigerant_recovered_kg: { type: "decimal", maxDigits: 6, decimalPlaces: 2, min: 0, default: 0 },
  added_from_cylinder: { type: "fk", nullable: true, default: null },
  recovered_into_cylinder: { type: "fk", nullable: true, default: null },
  leak_test_result: { type: "string", blank: true, maxLength: 20, default: "" },
  vacuum_result: { type: "string", blank: true, maxLength: 20, default: "" },
  parts_replaced: { type: "string", blank: true, default: "" },
  safety_checklist: { type: "json", default: () => ({}) },
  summary: { type: "string", blank: true, default: "" },
};

const CYLINDER_FIELDS = ["added_from_cylinder", "recovered_into_cylinder"];
const AMOUNT_LOCKED = ["refrigerant_added_kg", "refrigerant_recovered_kg", "refrigerant_type"];

/** Reports the user may see: their own, their facilities', their roster's, or all (admin). */
async function reportScope(user) {
  if (user.role === "technician") {
    const profile = await TechnicianProfile.findOne({ user: user._id }, { _id: 1 }).lean();
    return { technician: profile ? profile._id : -1 };
  }
  if (user.role === "facility_manager") {
    const facilities = await Facility.find({ owner: user._id }, { _id: 1 }).lean();
    const jobs = await JobRequest.find({ facility: { $in: facilities.map((f) => f._id) } }, { _id: 1 }).lean();
    return { job: { $in: jobs.map((j) => j._id) } };
  }
  if (user.role === "contractor_manager") {
    const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
    const roster = await TechnicianProfile.find({ contractor: { $in: companies.map((c) => c._id) } }, { _id: 1 }).lean();
    return { technician: { $in: roster.map((t) => t._id) } };
  }
  return {};
}

const assertTechnicianProfile = async (user) => {
  const profile = user.role === "technician" ? await TechnicianProfile.findOne({ user: user._id }).lean() : null;
  if (!profile) throw forbidden("Only technicians can submit service reports.");
  return profile;
};

const toStoredReport = (data) => {
  const out = { ...data };
  for (const field of ["refrigerant_added_kg", "refrigerant_recovered_kg"]) if (field in out) out[field] = dec(out[field]);
  return out;
};

async function requireReferences(data) {
  if (!(await RefrigerantType.exists({ _id: data.refrigerant_type }))) {
    throw validationError({ refrigerant_type: `Invalid pk "${data.refrigerant_type}" - object does not exist.` });
  }
  for (const field of CYLINDER_FIELDS) {
    if (data[field] && !(await RefrigerantCylinder.exists({ _id: data[field] }))) {
      throw validationError({ [field]: `Invalid pk "${data[field]}" - object does not exist.` });
    }
  }
}

router.get("/service-reports", async (req, res) => {
  const filter = allOf(
    (await reportScope(req.user)),
    filtersFrom(req, { job: ["job", "int"], technician: ["technician", "int"], status: "status" }),
  );
  res.json(
    await paginate(req, {
      model: ServiceReport,
      filter,
      build: (skip, limit) => ServiceReport.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: (rows) => presentReports(rows, req),
    })
  );
});

router.post("/service-reports", async (req, res) => {
  const technician = await assertTechnicianProfile(req.user);
  const data = validateBody(req.body, REPORT_SPEC);

  const job = await JobRequest.findById(data.job).lean();
  if (!job) throw validationError({ job: `Invalid pk "${data.job}" - object does not exist.` });
  if (await ServiceReport.exists({ job: job._id })) {
    throw validationError({ job: "service report with this job already exists." });
  }
  await requireReferences(data);

  const refrigerantType = await RefrigerantType.findById(data.refrigerant_type).lean();
  if (data.added_from_cylinder) {
    await validateCylinderUse(data.added_from_cylinder, {
      field: "added_from_cylinder", kind: "supply", refrigerantType, kg: data.refrigerant_added_kg, technician,
    });
  }
  if (data.recovered_into_cylinder) {
    await validateCylinderUse(data.recovered_into_cylinder, {
      field: "recovered_into_cylinder", kind: "recovery", refrigerantType, kg: data.refrigerant_recovered_kg, technician,
    });
  }

  const assignment = await JobAssignment.findOne({ job: job._id }).lean();
  if (!assignment || assignment.technician !== technician._id) throw forbidden("You are not assigned to this job.");

  const report = await ServiceReport.create({
    ...toStoredReport(data),
    technician: technician._id,
    technician_signed_at: new Date(),
  });

  // Move the kilograms; if any move fails the whole submission is undone so no
  // report exists whose refrigerant never actually left a cylinder.
  try {
    const { audits } = await applyCylinderMovements(report.toObject(), req.user, technician);
    await JobRequest.updateOne({ _id: job._id }, { status: "in_progress" });
    for (const audit of audits) await recordAudit(req.user, audit.action, "RefrigerantCylinder", audit.id, audit.metadata);
  } catch (error) {
    await ServiceReport.deleteOne({ _id: report._id });
    throw error;
  }
  res.status(201).json((await presentReports([report.toObject()], req))[0]);
});

router.get("/service-reports/:id", async (req, res) => {
  const report = await getScoped(ServiceReport, req, await reportScope(req.user));
  res.json((await presentReports([report], req))[0]);
});

async function updateReport(req, res, partial) {
  const report = await getScoped(ServiceReport, req, await reportScope(req.user));
  if (!isAdmin(req.user)) {
    const own = await TechnicianProfile.findOne({ user: req.user._id }, { _id: 1 }).lean();
    if (req.user.role !== "technician" || !own || own._id !== report.technician) {
      throw forbidden("Only the technician who wrote this report can change it.");
    }
  }
  const spec = Object.fromEntries(Object.entries(REPORT_SPEC).filter(([name]) => name !== "job"));
  const data = validateBody(req.body, spec, { partial });

  // Cylinder balances already moved when the report was submitted, so letting
  // these change afterwards would silently desync the ledger.
  for (const field of CYLINDER_FIELDS) {
    if (field in data && data[field] !== report[field]) {
      throw validationError({ [field]: "Cylinders can only be chosen when the report is first submitted." });
    }
  }
  if (report.added_from_cylinder || report.recovered_into_cylinder) {
    for (const field of AMOUNT_LOCKED) {
      const current = field === "refrigerant_type" ? report[field] : num(report[field]);
      if (field in data && data[field] !== current) {
        throw validationError({ [field]: "This can't be changed once refrigerant was logged against a cylinder." });
      }
    }
  }
  if (data.refrigerant_type !== undefined) await requireReferences({ ...data, added_from_cylinder: null, recovered_into_cylinder: null });

  const updated = await ServiceReport.findByIdAndUpdate(report._id, toStoredReport(data), { new: true }).lean();
  res.json((await presentReports([updated], req))[0]);
}
router.put("/service-reports/:id", (req, res) => updateReport(req, res, false));
router.patch("/service-reports/:id", (req, res) => updateReport(req, res, true));

async function decide(req, res, outcome) {
  const report = await getScoped(ServiceReport, req, await reportScope(req.user));
  const job = await JobRequest.findById(report.job).lean();
  const facility = await Facility.findById(job.facility).lean();
  if (req.user.role !== "facility_manager" || facility.owner !== req.user._id) {
    throw forbidden(`Only the owning facility manager can ${outcome === "approved" ? "approve" : "reject"} this report.`);
  }

  const updated = await ServiceReport.findByIdAndUpdate(
    report._id,
    { status: outcome, facility_approved_by: req.user._id, facility_approved_at: new Date() },
    { new: true }
  ).lean();

  const equipment = await Equipment.findById(job.equipment).lean();
  const technician = await TechnicianProfile.findById(report.technician).lean();
  if (outcome === "approved") {
    await JobRequest.updateOne({ _id: job._id }, { status: "completed" });
    await notify(technician?.user, "report", "Report approved", equipment?.name ?? "", `/my-jobs/${job._id}/report`);
  } else {
    await notify(technician?.user, "report", "Report needs changes", equipment?.name ?? "", `/my-jobs/${job._id}/report`);
  }
  res.json((await presentReports([updated], req))[0]);
}
router.post("/service-reports/:id/approve", (req, res) => decide(req, res, "approved"));
router.post("/service-reports/:id/reject", (req, res) => decide(req, res, "rejected"));

router.get("/service-reports/:id/pdf", async (req, res) => {
  const report = await getScoped(ServiceReport, req, await reportScope(req.user));
  const job = await JobRequest.findById(report.job).lean();
  const [equipment, facility, refrigerant, technician, addedFrom, recoveredInto, approver] = await Promise.all([
    Equipment.findById(job.equipment).lean(),
    Facility.findById(job.facility).lean(),
    RefrigerantType.findById(report.refrigerant_type).lean(),
    TechnicianProfile.findById(report.technician).lean(),
    report.added_from_cylinder ? RefrigerantCylinder.findById(report.added_from_cylinder).lean() : null,
    report.recovered_into_cylinder ? RefrigerantCylinder.findById(report.recovered_into_cylinder).lean() : null,
    report.facility_approved_by ? User.findById(report.facility_approved_by).lean() : null,
  ]);
  const technicianUser = await User.findById(technician.user).lean();
  const bytes = await renderServiceReport({
    report, job, equipment, facility, refrigerant, addedFrom, recoveredInto,
    technicianName: fullNameOf(technicianUser), approver: approver ? fullNameOf(approver) : null,
  });
  sendPdf(res, bytes, `service-report-job-${job._id}.pdf`);
});

// ---- photos -------------------------------------------------------------------

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

async function photoScope(user) {
  if (user.role === "technician" || user.role === "facility_manager") {
    const reports = await ServiceReport.find(await reportScope(user), { _id: 1 }).lean();
    return { report: { $in: reports.map((r) => r._id) } };
  }
  return {};
}

router.get("/service-report-photos", async (req, res) => {
  const filter = allOf((await photoScope(req.user)), filtersFrom(req, { report: ["report", "int"] }));
  res.json(
    await paginate(req, {
      model: ServiceReportPhoto,
      filter,
      build: (skip, limit) => ServiceReportPhoto.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      present: (rows) => presentReportPhotos(rows, req),
    })
  );
});

router.post("/service-report-photos", multipart.single("image"), async (req, res) => {
  const data = validateBody(req.body, {
    report: { type: "fk", required: true },
    caption: { type: "string", blank: true, maxLength: 200, default: "" },
    is_before: { type: "bool", default: true },
  });
  if (!req.file) throw validationError({ image: "No file was submitted." });
  if (req.file.size > MAX_FILE_BYTES) throw validationError({ image: "Image must be no larger than 1 MB." });
  if (!IMAGE_TYPES.has(detectMediaType(req.file.buffer))) {
    throw validationError({
      image: "Upload a valid image. The file you uploaded was either not an image or a corrupted image.",
    });
  }

  const report = await ServiceReport.findById(data.report).lean();
  if (!report) throw validationError({ report: `Invalid pk "${data.report}" - object does not exist.` });
  const profile = await TechnicianProfile.findOne({ user: req.user._id }, { _id: 1 }).lean();
  if (req.user.role !== "technician" || !profile || report.technician !== profile._id) {
    throw forbidden("You can only attach photos to your own service reports.");
  }

  const image = await storeUpload("service_report_photos", req.file);
  const photo = await ServiceReportPhoto.create({ ...data, image });
  res.status(201).json((await presentReportPhotos([photo.toObject()], req))[0]);
});

router.get("/service-report-photos/:id", async (req, res) => {
  const photo = await getScoped(ServiceReportPhoto, req, await photoScope(req.user));
  res.json((await presentReportPhotos([photo], req))[0]);
});

router.delete("/service-report-photos/:id", async (req, res) => {
  const photo = await getScoped(ServiceReportPhoto, req, await photoScope(req.user));
  const report = await ServiceReport.findById(photo.report).lean();
  const profile = await TechnicianProfile.findOne({ user: req.user._id }, { _id: 1 }).lean();
  if (!isAdmin(req.user) && (!profile || report.technician !== profile._id)) {
    throw forbidden("You can only remove photos from your own service reports.");
  }
  await ServiceReportPhoto.deleteOne({ _id: photo._id });
  res.status(204).end();
});

// ---- cylinders ----------------------------------------------------------------
// Ledger-like: registered once, then only moved by service reports. No update or
// delete, so balances can't be edited behind the ledger's back.

async function cylinderScope(user) {
  if (user.role === "contractor_manager") {
    const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
    return { company: { $in: companies.map((c) => c._id) } };
  }
  if (user.role === "technician") {
    const profile = await TechnicianProfile.findOne({ user: user._id }, { contractor: 1 }).lean();
    return { company: profile?.contractor ?? -1 };
  }
  if (isAdmin(user)) return {};
  return { _id: -1 };
}

router.get("/cylinders", async (req, res) => {
  const filter = allOf(
    (await cylinderScope(req.user)),
    filtersFrom(req, { company: ["company", "int"], kind: "kind", refrigerant_type: ["refrigerant_type", "int"] }),
  );
  res.json(
    await paginate(req, {
      model: RefrigerantCylinder,
      filter,
      build: (skip, limit) => RefrigerantCylinder.find(filter).sort({ serial_number: 1 }).skip(skip).limit(limit).lean(),
      present: presentCylinders,
    })
  );
});

router.post("/cylinders", async (req, res) => {
  const data = validateBody(req.body, {
    company: { type: "fk", required: true },
    serial_number: { type: "string", required: true, maxLength: 64 },
    refrigerant_type: { type: "fk", required: true },
    kind: { type: "choice", choices: C.CylinderKind.values, default: "supply" },
    capacity_kg: { type: "decimal", required: true, maxDigits: 8, decimalPlaces: 2 },
    current_kg: { type: "decimal", maxDigits: 8, decimalPlaces: 2, default: 0 },
  });
  const company = await ContractorCompany.findById(data.company).lean();
  if (!company) throw validationError({ company: `Invalid pk "${data.company}" - object does not exist.` });
  if (!(await RefrigerantType.exists({ _id: data.refrigerant_type }))) {
    throw validationError({ refrigerant_type: `Invalid pk "${data.refrigerant_type}" - object does not exist.` });
  }
  if (data.capacity_kg <= 0) throw validationError({ capacity_kg: "Capacity must be greater than 0." });
  if (data.current_kg < 0) throw validationError({ current_kg: "Starting amount can't be negative." });
  if (data.current_kg > data.capacity_kg) {
    throw validationError({ current_kg: "Starting amount can't exceed the cylinder's capacity." });
  }
  if (req.user.role !== "contractor_manager" || company.manager !== req.user._id) {
    throw forbidden("Only the managing contractor can register cylinders for this company.");
  }
  if (await RefrigerantCylinder.exists({ company: company._id, serial_number: data.serial_number })) {
    throw new ApiError(400, { non_field_errors: ["The fields company, serial_number must make a unique set."] });
  }

  const cylinder = await RefrigerantCylinder.create({
    ...data, capacity_kg: dec(data.capacity_kg), current_kg: dec(data.current_kg),
  });
  if (data.current_kg > 0) {
    await CylinderTransaction.create({
      cylinder: cylinder._id, kind: "initial_fill", amount_kg: dec(data.current_kg),
      balance_after_kg: dec(data.current_kg), created_by: req.user._id,
    });
  }
  await recordAudit(req.user, "cylinder.register", "RefrigerantCylinder", cylinder._id, { kg: data.current_kg.toFixed(2) });
  res.status(201).json((await presentCylinders([cylinder.toObject()]))[0]);
});

router.get("/cylinders/:id", async (req, res) => {
  const cylinder = await getScoped(RefrigerantCylinder, req, await cylinderScope(req.user));
  res.json((await presentCylinders([cylinder]))[0]);
});

router.get("/cylinders/:id/history", async (req, res) => {
  const cylinder = await getScoped(RefrigerantCylinder, req, await cylinderScope(req.user));
  const rows = await CylinderTransaction.find({ cylinder: cylinder._id }).sort({ created_at: -1, _id: -1 }).lean();
  res.json(await presentTransactions(rows));
});

// ---- refrigerant dashboard and export -----------------------------------------

async function scopedReports(req) {
  const filter = { ...(await reportScope(req.user)) };
  const facilityId = /^\d+$/.test(String(req.query.facility ?? "")) ? Number(req.query.facility) : null;
  if (facilityId !== null) {
    const jobs = await JobRequest.find({ facility: facilityId }, { _id: 1 }).lean();
    const allowed = filter.job?.$in ? new Set(filter.job.$in) : null;
    const ids = jobs.map((j) => j._id).filter((id) => !allowed || allowed.has(id));
    filter.job = { $in: ids };
  }
  return ServiceReport.find(filter).lean();
}

/** Refrigerant added/recovered per calendar month for the last `months`, oldest first, empty months included. */
function monthlySeries(reports, months = 12) {
  const today = new Date();
  const keys = [];
  let year = today.getUTCFullYear();
  let month = today.getUTCMonth() + 1;
  for (let i = 0; i < months; i += 1) {
    keys.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  keys.reverse();

  const added = Object.fromEntries(keys.map((k) => [k, 0]));
  const recovered = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const report of reports) {
    const key = report.created_at.toISOString().slice(0, 7);
    if (key in added) {
      added[key] += num(report.refrigerant_added_kg);
      recovered[key] += num(report.refrigerant_recovered_kg);
    }
  }
  return keys.map((k) => ({ month: k, added_kg: round2(added[k]), recovered_kg: round2(recovered[k]) }));
}

/** Equipment in scope, derived from the visible service reports. */
async function leakRateRows(reports) {
  const jobs = await byId(JobRequest, reports.map((r) => r.job), { equipment: 1 });
  const equipmentIds = [...new Set([...jobs.values()].map((j) => j.equipment))];
  if (!equipmentIds.length) return [];
  const equipment = await Equipment.find({ _id: { $in: equipmentIds } }).lean();
  const facilities = await byId(Facility, equipment.map((e) => e.facility));
  const leaks = await computeLeakRates(equipment);
  return equipment.map((e) => ({ ...leaks.get(e._id), facility_name: facilities.get(e.facility)?.name ?? "" }));
}

router.get("/dashboard/refrigerant-summary", async (req, res) => {
  const reports = await scopedReports(req);
  const refrigerants = await byId(RefrigerantType, reports.map((r) => r.refrigerant_type));

  let totalAdded = 0;
  let totalRecovered = 0;
  let co2e = 0;
  const byRefrigerant = {};
  for (const report of reports) {
    const added = num(report.refrigerant_added_kg);
    const recovered = num(report.refrigerant_recovered_kg);
    const leaked = Math.max(added - recovered, 0);
    const refrigerant = refrigerants.get(report.refrigerant_type);
    totalAdded += added;
    totalRecovered += recovered;
    co2e += leaked * (refrigerant?.gwp ?? 0);
    const entry = (byRefrigerant[refrigerant?.code ?? "unknown"] ??= { added_kg: 0, recovered_kg: 0, leaked_estimate_kg: 0 });
    entry.added_kg += added;
    entry.recovered_kg += recovered;
    entry.leaked_estimate_kg += leaked;
  }
  for (const entry of Object.values(byRefrigerant)) {
    for (const key of Object.keys(entry)) entry[key] = round2(entry[key]);
  }

  res.json({
    is_estimate: true,
    note: "Leak and CO2e figures are calculated as added-minus-recovered; not independently lab-confirmed.",
    total_added_kg: round2(totalAdded),
    total_recovered_kg: round2(totalRecovered),
    leaked_estimate_kg: round2(Math.max(totalAdded - totalRecovered, 0)),
    co2e_estimate_kg: round2(co2e),
    by_refrigerant: byRefrigerant,
    report_count: reports.length,
    monthly: monthlySeries(reports),
    leak_rate_by_equipment: await leakRateRows(reports),
  });
});

// Whole numbers keep one decimal ("45.0"), as the exports have always printed them.
const pyNumber = (n) => (typeof n === "number" && Number.isInteger(n) ? n.toFixed(1) : n);

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

router.get("/dashboard/refrigerant-summary/export", async (req, res) => {
  const rows = await leakRateRows(await scopedReports(req));
  const lines = [
    ["Equipment", "Facility", "Charge (kg)", "Added in last 12mo (kg)", "Leak Rate %", "Threshold %", "Exceeds Threshold", "Note"],
    ...rows.map((r) => [
      r.equipment_name, r.facility_name, pyNumber(r.charge_kg), pyNumber(r.added_kg_12mo), pyNumber(r.leak_rate_percent),
      pyNumber(r.threshold_percent), r.exceeds_threshold ? "True" : "False", r.note || "",
    ]),
  ];
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="refrigerant-compliance.csv"',
  });
  res.send(`${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`);
});

export default router;
