import { Router } from "express";
import * as C from "../lib/choices.js";
import { dec, num } from "../lib/decimal.js";
import { forbidden, validationError } from "../lib/errors.js";
import { getScoped, sendPdf, timestamp } from "../lib/http.js";
import { allOf, filtersFrom, paginate } from "../lib/pagination.js";
import { validateBody } from "../lib/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  ContractorCompany, Equipment, Facility, JobAssignment, JobRequest, RefrigerantType, ServiceReport, TechnicianProfile, User,
  byId, fullNameOf, isAdmin,
} from "../models/index.js";
import { presentEquipment, presentFacilities } from "../presenters.js";
import { renderEquipmentLabel } from "../services/documents.js";
import { computeLeakRate } from "../services/leakRate.js";

const router = Router();
router.use("/facilities", authenticate);
router.use("/equipment", authenticate);

const FACILITY_SPEC = {
  name: { type: "string", required: true, maxLength: 200 },
  segment: { type: "choice", choices: C.FacilitySegment.values, default: "cold_storage" },
  address: { type: "string", required: true, maxLength: 300 },
  service_area: { type: "string", required: true, maxLength: 120 },
  contact_name: { type: "string", blank: true, maxLength: 120, default: "" },
  contact_phone: { type: "phone", default: "" },
};

async function relatedJobIds(user) {
  let technicianIds = [];
  if (user.role === "technician") {
    const profile = await TechnicianProfile.findOne({ user: user._id }, { _id: 1 }).lean();
    if (profile) technicianIds = [profile._id];
  } else if (user.role === "contractor_manager") {
    const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
    const roster = await TechnicianProfile.find({ contractor: { $in: companies.map((company) => company._id) } }, { _id: 1 }).lean();
    technicianIds = roster.map((technician) => technician._id);
  }
  if (!technicianIds.length) return [];
  const assignments = await JobAssignment.find({ technician: { $in: technicianIds } }, { job: 1 }).lean();
  return assignments.map((assignment) => assignment.job);
}

async function facilityScope(user) {
  if (isAdmin(user)) return {};
  if (user.role === "facility_manager") return { owner: user._id };
  const jobIds = await relatedJobIds(user);
  const facilities = await JobRequest.distinct("facility", { _id: { $in: jobIds } });
  return { _id: { $in: facilities } };
}

async function ownFacilityOr403(req) {
  const facility = await getScoped(Facility, req, await facilityScope(req.user));
  if (req.user.role !== "facility_manager" || facility.owner !== req.user._id) throw forbidden();
  return facility;
}

router.get("/facilities", async (req, res) => {
  const filter = allOf(await facilityScope(req.user), filtersFrom(req, { segment: "segment" }));
  res.json(
    await paginate(req, {
      model: Facility,
      filter,
      build: (skip, limit) => Facility.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: presentFacilities,
    })
  );
});

router.post("/facilities", async (req, res) => {
  if (req.user.role !== "facility_manager") throw forbidden("Only facility managers can register facilities.");
  const data = validateBody(req.body, FACILITY_SPEC);
  const facility = await Facility.create({ ...data, owner: req.user._id });
  res.status(201).json((await presentFacilities([facility.toObject()]))[0]);
});

router.get("/facilities/:id", async (req, res) => {
  const facility = await getScoped(Facility, req, await facilityScope(req.user));
  res.json((await presentFacilities([facility]))[0]);
});

async function updateFacility(req, res, partial) {
  const facility = await ownFacilityOr403(req);
  const data = validateBody(req.body, FACILITY_SPEC, { partial });
  const updated = await Facility.findByIdAndUpdate(facility._id, data, { new: true }).lean();
  res.json((await presentFacilities([updated]))[0]);
}
router.put("/facilities/:id", (req, res) => updateFacility(req, res, false));
router.patch("/facilities/:id", (req, res) => updateFacility(req, res, true));

router.delete("/facilities/:id", async (req, res) => {
  const facility = await ownFacilityOr403(req);
  const units = await Equipment.find({ facility: facility._id }, { _id: 1 }).lean();
  const jobs = await JobRequest.find({ facility: facility._id }, { _id: 1 }).lean();
  // Cascade, like the relational schema this replaces: a facility owns its equipment and jobs.
  const jobIds = jobs.map((j) => j._id);
  await Promise.all([
    JobAssignment.deleteMany({ job: { $in: jobIds } }),
    ServiceReport.deleteMany({ job: { $in: jobIds } }),
    JobRequest.deleteMany({ facility: facility._id }),
    Equipment.deleteMany({ _id: { $in: units.map((u) => u._id) } }),
    Facility.deleteOne({ _id: facility._id }),
  ]);
  res.status(204).end();
});

// ---- equipment ----------------------------------------------------------------

const EQUIPMENT_SPEC = {
  facility: { type: "fk", required: true },
  name: { type: "string", required: true, maxLength: 150 },
  category: { type: "choice", required: true, choices: C.EquipmentCategory.values },
  refrigerant_type: { type: "fk", required: true },
  capacity: { type: "string", blank: true, maxLength: 100, default: "" },
  refrigerant_charge_kg: { type: "decimal", nullable: true, maxDigits: 7, decimalPlaces: 2, default: null },
  criticality: { type: "choice", choices: C.Criticality.values, default: "medium" },
  install_date: { type: "date", nullable: true, default: null },
};

async function equipmentScope(user) {
  if (isAdmin(user)) return {};
  if (user.role === "facility_manager") {
    const facilities = await Facility.find({ owner: user._id }, { _id: 1 }).lean();
    return { facility: { $in: facilities.map((facility) => facility._id) } };
  }
  const jobIds = await relatedJobIds(user);
  const equipment = await JobRequest.distinct("equipment", { _id: { $in: jobIds } });
  return { _id: { $in: equipment } };
}

async function relatedOr400(data, user, currentFacilityId) {
  const facilityId = data.facility ?? currentFacilityId;
  if (facilityId !== undefined) {
    const facility = await Facility.findById(facilityId).lean();
    if (!facility) throw validationError({ facility: `Invalid pk "${facilityId}" - object does not exist.` });
    if (!isAdmin(user) && (user.role !== "facility_manager" || facility.owner !== user._id)) {
      throw forbidden("Only the owning facility manager can manage equipment.");
    }
  }
  if (data.refrigerant_type !== undefined && !(await RefrigerantType.exists({ _id: data.refrigerant_type }))) {
    throw validationError({ refrigerant_type: `Invalid pk "${data.refrigerant_type}" - object does not exist.` });
  }
}

const toStored = (data) => {
  const out = { ...data };
  if ("refrigerant_charge_kg" in out) out.refrigerant_charge_kg = out.refrigerant_charge_kg === null ? null : dec(out.refrigerant_charge_kg);
  return out;
};

router.get("/equipment", async (req, res) => {
  const filter = allOf(
    (await equipmentScope(req.user)),
    filtersFrom(req, { facility: ["facility", "int"], category: "category", criticality: "criticality" }),
  );
  res.json(
    await paginate(req, {
      model: Equipment,
      filter,
      build: (skip, limit) => Equipment.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: presentEquipment,
    })
  );
});

router.post("/equipment", async (req, res) => {
  const data = validateBody(req.body, EQUIPMENT_SPEC);
  await relatedOr400(data, req.user);
  const created = await Equipment.create(toStored(data));
  res.status(201).json((await presentEquipment([created.toObject()]))[0]);
});

router.get("/equipment/:id", async (req, res) => {
  const unit = await getScoped(Equipment, req, await equipmentScope(req.user));
  res.json((await presentEquipment([unit]))[0]);
});

async function updateEquipment(req, res, partial) {
  const unit = await getScoped(Equipment, req, await equipmentScope(req.user));
  const data = validateBody(req.body, EQUIPMENT_SPEC, { partial });
  await relatedOr400(data, req.user, unit.facility);
  const updated = await Equipment.findByIdAndUpdate(unit._id, toStored(data), { new: true }).lean();
  res.json((await presentEquipment([updated]))[0]);
}
router.put("/equipment/:id", (req, res) => updateEquipment(req, res, false));
router.patch("/equipment/:id", (req, res) => updateEquipment(req, res, true));

router.delete("/equipment/:id", async (req, res) => {
  const unit = await getScoped(Equipment, req, await equipmentScope(req.user));
  await relatedOr400({}, req.user, unit.facility);
  const jobs = await JobRequest.find({ equipment: unit._id }, { _id: 1 }).lean();
  const jobIds = jobs.map((j) => j._id);
  await Promise.all([
    JobAssignment.deleteMany({ job: { $in: jobIds } }),
    ServiceReport.deleteMany({ job: { $in: jobIds } }),
    JobRequest.deleteMany({ equipment: unit._id }),
    Equipment.deleteOne({ _id: unit._id }),
  ]);
  res.status(204).end();
});

router.get("/equipment/:id/label", async (req, res) => {
  const unit = await getScoped(Equipment, req, await equipmentScope(req.user));
  const [facility, refrigerant] = await Promise.all([
    Facility.findById(unit.facility).lean(),
    RefrigerantType.findById(unit.refrigerant_type).lean(),
  ]);
  const bytes = await renderEquipmentLabel({ equipment: unit, facility, refrigerant });
  sendPdf(res, bytes, `equipment-label-${unit._id}.pdf`);
});

/** Everything known about one unit: its specs, leak rate and the jobs and reports raised against it. */
router.get("/equipment/:id/history", async (req, res) => {
  const unit = await getScoped(Equipment, req, await equipmentScope(req.user));
  const [facility, leak, jobs] = await Promise.all([
    Facility.findById(unit.facility).lean(),
    computeLeakRate(unit),
    JobRequest.find({ equipment: unit._id }).sort({ created_at: -1, _id: -1 }).limit(50).lean(),
  ]);

  const reports = jobs.length ? await ServiceReport.find({ job: { $in: jobs.map((j) => j._id) } }).lean() : [];
  const reportByJob = new Map(reports.map((r) => [r.job, r]));
  const technicians = await byId(TechnicianProfile, reports.map((r) => r.technician));
  const users = await byId(User, [...technicians.values()].map((t) => t.user));

  res.json({
    equipment: (await presentEquipment([unit]))[0],
    facility_name: facility?.name ?? "",
    leak_rate: leak,
    jobs: jobs.map((j) => ({
      id: j._id, status: j.status, risk_level: j.risk_level, urgency: j.urgency, description: j.description,
      created_at: timestamp(j.created_at), scheduled_for: timestamp(j.scheduled_for),
    })),
    reports: jobs
      .filter((j) => reportByJob.has(j._id))
      .map((j) => {
        const r = reportByJob.get(j._id);
        const user = users.get(technicians.get(r.technician)?.user);
        return {
          id: r._id, job: j._id, created_at: timestamp(r.created_at), status: r.status,
          refrigerant_added_kg: num(r.refrigerant_added_kg), refrigerant_recovered_kg: num(r.refrigerant_recovered_kg),
          summary: r.summary, technician: user ? fullNameOf(user) : "",
        };
      }),
  });
});

export default router;
