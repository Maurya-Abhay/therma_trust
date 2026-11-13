import { Router } from "express";
import * as C from "../lib/choices.js";
import { ApiError, forbidden, notFound, validationError } from "../lib/errors.js";
import { getScoped } from "../lib/http.js";
import { allOf, filtersFrom, paginate } from "../lib/pagination.js";
import { validateBody } from "../lib/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  ContractorCompany, Equipment, Facility, JobAssignment, JobFeedback, JobRequest, RefrigerantType, ServiceReport,
  TechnicianProfile, fullNameOf, isAdmin,
} from "../models/index.js";
import { presentAssignments, presentFeedback, presentJobs } from "../presenters.js";
import { recordAudit } from "../services/audit.js";
import { rankTechnicians, scoreOne } from "../services/matching.js";
import { notify } from "../services/notify.js";
import { classify } from "../services/risk.js";

const router = Router();
router.use("/jobs", authenticate);

const JOB_SPEC = {
  facility: { type: "fk", required: true },
  equipment: { type: "fk", required: true },
  description: { type: "string", required: true },
  urgency: { type: "choice", choices: C.Urgency.values, default: "scheduled" },
  scheduled_for: { type: "datetime", nullable: true, default: null },
};

/** Which jobs a user may see: a manager's own facilities, a technician's assignments, a contractor's roster's. */
async function jobScope(user) {
  if (user.role === "facility_manager") {
    const facilities = await Facility.find({ owner: user._id }, { _id: 1 }).lean();
    return { facility: { $in: facilities.map((f) => f._id) } };
  }
  if (user.role === "technician") {
    const profile = await TechnicianProfile.findOne({ user: user._id }, { _id: 1 }).lean();
    const assignments = profile ? await JobAssignment.find({ technician: profile._id }, { job: 1 }).lean() : [];
    return { _id: { $in: assignments.map((a) => a.job) } };
  }
  if (user.role === "contractor_manager") {
    const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
    const roster = await TechnicianProfile.find({ contractor: { $in: companies.map((c) => c._id) } }, { _id: 1 }).lean();
    const assignments = await JobAssignment.find({ technician: { $in: roster.map((t) => t._id) } }, { job: 1 }).lean();
    return { _id: { $in: assignments.map((a) => a.job) } };
  }
  return {};
}

/** Raising or changing a job belongs to the facility that owns it (or an admin). */
function assertCanManage(user, facility) {
  if (isAdmin(user)) return;
  if (user.role === "facility_manager" && facility.owner === user._id) return;
  throw forbidden("Only the facility manager can change a job request.");
}

async function resolveFacilityAndEquipment(data, current = {}) {
  const facilityId = data.facility ?? current.facility;
  const equipmentId = data.equipment ?? current.equipment;
  const facility = await Facility.findById(facilityId).lean();
  if (!facility) throw validationError({ facility: `Invalid pk "${facilityId}" - object does not exist.` });
  const equipment = await Equipment.findById(equipmentId).lean();
  if (!equipment) throw validationError({ equipment: `Invalid pk "${equipmentId}" - object does not exist.` });
  if (equipment.facility !== facility._id) {
    throw validationError({ equipment: "This equipment does not belong to the selected facility." });
  }
  return { facility, equipment };
}

router.get("/jobs", async (req, res) => {
  const filter = allOf(
    (await jobScope(req.user)),
    filtersFrom(req, {
      facility: ["facility", "int"], equipment: ["equipment", "int"], status: "status", risk_level: "risk_level",
      scheduled_for: ["scheduled_for", "datetime", "$eq"],
      scheduled_for__gte: ["scheduled_for", "datetime", "$gte"],
      scheduled_for__lte: ["scheduled_for", "datetime", "$lte"],
    }),
  );
  res.json(
    await paginate(req, {
      model: JobRequest,
      filter,
      build: (skip, limit) => JobRequest.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: presentJobs,
    })
  );
});

router.post("/jobs", async (req, res) => {
  const data = validateBody(req.body, JOB_SPEC);
  const { facility, equipment } = await resolveFacilityAndEquipment(data);
  assertCanManage(req.user, facility);

  const refrigerant = await RefrigerantType.findById(equipment.refrigerant_type).lean();
  const { riskLevel, requiredCapabilities } = classify(equipment, refrigerant, data.urgency);
  const job = await JobRequest.create({
    ...data,
    created_by: req.user._id,
    risk_level: riskLevel,
    required_capabilities: requiredCapabilities,
  });
  res.status(201).json((await presentJobs([job.toObject()]))[0]);
});

router.get("/jobs/:id", async (req, res) => {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  res.json((await presentJobs([job]))[0]);
});

async function updateJob(req, res, partial) {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  const currentFacility = await Facility.findById(job.facility).lean();
  assertCanManage(req.user, currentFacility);

  const data = validateBody(req.body, JOB_SPEC, { partial });
  if (data.facility !== undefined || data.equipment !== undefined) {
    const { facility } = await resolveFacilityAndEquipment(data, job);
    assertCanManage(req.user, facility);
  }
  const updated = await JobRequest.findByIdAndUpdate(job._id, data, { new: true }).lean();
  res.json((await presentJobs([updated]))[0]);
}
router.put("/jobs/:id", (req, res) => updateJob(req, res, false));
router.patch("/jobs/:id", (req, res) => updateJob(req, res, true));

router.delete("/jobs/:id", async (req, res) => {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  assertCanManage(req.user, await Facility.findById(job.facility).lean());
  await Promise.all([
    JobAssignment.deleteOne({ job: job._id }),
    JobFeedback.deleteOne({ job: job._id }),
    ServiceReport.deleteOne({ job: job._id }),
    JobRequest.deleteOne({ _id: job._id }),
  ]);
  res.status(204).end();
});

// ---- ratings ------------------------------------------------------------------

router.get("/jobs/:id/feedback", async (req, res) => {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  res.json(presentFeedback(await JobFeedback.findOne({ job: job._id }).lean()));
});

router.post("/jobs/:id/feedback", async (req, res) => {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  const facility = await Facility.findById(job.facility).lean();
  if (req.user.role !== "facility_manager" || facility.owner !== req.user._id) {
    throw forbidden("Only the facility manager who raised this job can rate it.");
  }
  if (job.status !== "completed") throw new ApiError(400, { detail: "A job can only be rated once it is completed." });
  if (await JobFeedback.exists({ job: job._id })) throw new ApiError(409, { detail: "This job has already been rated." });

  const data = validateBody(req.body, {
    rating: { type: "int", required: true, min: 0 },
    comment: { type: "string", blank: true, maxLength: 500, default: "" },
  });
  if (data.rating < 1 || data.rating > 5) throw validationError({ rating: "Rating must be between 1 and 5." });

  const feedback = await JobFeedback.create({ ...data, job: job._id, created_by: req.user._id });
  await recordAudit(req.user, "job.feedback", "JobRequest", job._id, { rating: data.rating });

  const assignment = await JobAssignment.findOne({ job: job._id }).lean();
  if (assignment) {
    const [technician, equipment] = await Promise.all([
      TechnicianProfile.findById(assignment.technician).lean(),
      Equipment.findById(job.equipment).lean(),
    ]);
    await notify(technician?.user, "feedback", `You were rated ${data.rating}/5`, equipment?.name ?? "", "/my-jobs");
  }
  res.status(201).json(presentFeedback(feedback.toObject()));
});

// ---- matching and assignment --------------------------------------------------

router.get("/jobs/:id/matches", async (req, res) => {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  const results = await rankTechnicians(job);
  res.json(
    results.map((r) => ({
      technician_id: r.technician._id,
      name: r.user ? fullNameOf(r.user) : "",
      contractor: r.contractor ? r.contractor.name : null,
      score: r.score,
      breakdown: r.breakdown,
      missing_requirements: r.missing_requirements,
      is_qualified: r.is_qualified,
    }))
  );
});

router.post("/jobs/:id/assign", async (req, res) => {
  const job = await getScoped(JobRequest, req, await jobScope(req.user));
  assertCanManage(req.user, await Facility.findById(job.facility).lean());
  if (job.status !== "open") throw new ApiError(400, { detail: "Job is not open for assignment." });

  const technicianId = /^\d+$/.test(String(req.body?.technician_id ?? "")) ? Number(req.body.technician_id) : null;
  const technician = technicianId ? await TechnicianProfile.findById(technicianId).lean() : null;
  if (!technician) throw notFound("Technician not found.");

  const overrideWarning = Boolean(req.body?.override_warning);
  const overrideReason = typeof req.body?.override_reason === "string" ? req.body.override_reason : "";

  const result = await scoreOne(technician, job);
  const highRisk = C.HIGH_RISK_LEVELS.includes(job.risk_level);
  const needsOverride = highRisk && !result.is_qualified;

  if (needsOverride) {
    if (!overrideWarning) {
      throw new ApiError(409, {
        detail: "Technician is missing required verified capabilities for a high-risk job.",
        missing_requirements: result.missing_requirements,
        requires_override: true,
      });
    }
    if (!overrideReason) {
      throw new ApiError(400, { detail: "override_reason is required when overriding a capability warning." });
    }
  }

  const assignment = await JobAssignment.create({
    job: job._id,
    technician: technician._id,
    assigned_by: req.user._id,
    override_warning: needsOverride,
    override_reason: needsOverride ? overrideReason.slice(0, 300) : "",
  });
  await JobRequest.updateOne({ _id: job._id }, { status: "assigned" });

  await recordAudit(req.user, "job.assign", "JobRequest", job._id, {
    technician_id: technician._id,
    override_warning: assignment.override_warning,
    override_reason: assignment.override_reason,
  });

  const [equipment, facility] = await Promise.all([Equipment.findById(job.equipment).lean(), Facility.findById(job.facility).lean()]);
  await notify(technician.user, "job", "New job assigned", `${equipment.name} at ${facility.name}`, `/my-jobs/${job._id}/report`);
  res.status(201).json((await presentAssignments([assignment.toObject()]))[0]);
});

export default router;
