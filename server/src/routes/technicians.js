import { Router } from "express";
import QRCode from "qrcode";
import { config } from "../config.js";
import * as C from "../lib/choices.js";
import { ApiError, forbidden, notFound, validationError } from "../lib/errors.js";
import { getScoped, sendPdf } from "../lib/http.js";
import { allOf, filtersFrom, paginate } from "../lib/pagination.js";
import { constantTimeEqual } from "../lib/security.js";
import { validateBody } from "../lib/validate.js";
import { authenticate } from "../middleware/auth.js";
import { limiter } from "../middleware/throttle.js";
import { MAX_FILE_BYTES, multipart, readUpload, storeUpload } from "../middleware/upload.js";
import {
  CapabilitySkill, ContractorCompany, Credential, Facility, JobAssignment, JobRequest, RefrigerantType, TechnicianProfile, User,
  WorkHistoryEntry, fullNameOf, isAdmin,
} from "../models/index.js";
import {
  presentCapabilities, presentCredentials, presentTechnicians, presentWorkHistory,
} from "../presenters.js";
import { recordAudit } from "../services/audit.js";
import { notify } from "../services/notify.js";
import * as ocr from "../services/ocr.js";
import { passportDigest, passportContext, renderPassportPdf, verifiedFacts } from "../services/passport.js";

const router = Router();
for (const prefix of ["/technicians", "/credentials", "/capabilities", "/work-history"]) router.use(prefix, authenticate);

/** For a technician-role user, the profile ids they own (their records are the only ones they see). */
async function ownProfile(user) {
  return TechnicianProfile.findOne({ user: user._id }).lean();
}

async function technicianScope(user) {
  if (isAdmin(user)) return {};
  if (user.role === "technician") {
    const profile = await ownProfile(user);
    return { technician: profile ? profile._id : -1 };
  }
  if (user.role !== "contractor_manager") return { technician: { $in: [] } };

  const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
  const roster = await TechnicianProfile.find({ contractor: { $in: companies.map((company) => company._id) } }, { _id: 1 }).lean();
  return { technician: { $in: roster.map((technician) => technician._id) } };
}

async function technicianProfileScope(user) {
  if (isAdmin(user)) return {};
  if (user.role === "technician") {
    const profile = await ownProfile(user);
    return { _id: profile ? profile._id : -1 };
  }
  if (user.role === "contractor_manager") {
    const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
    const roster = await TechnicianProfile.find({ contractor: { $in: companies.map((company) => company._id) } }, { _id: 1 }).lean();
    return { _id: { $in: roster.map((technician) => technician._id) } };
  }
  if (user.role === "facility_manager") {
    const facilities = await Facility.find({ owner: user._id }, { _id: 1 }).lean();
    const jobs = await JobRequest.find({ facility: { $in: facilities.map((facility) => facility._id) } }, { _id: 1 }).lean();
    const assignments = await JobAssignment.find({ job: { $in: jobs.map((job) => job._id) } }, { technician: 1 }).lean();
    return { _id: { $in: assignments.map((assignment) => assignment.technician) } };
  }
  return { _id: { $in: [] } };
}

async function assertCanWriteTechnicianData(user, technicianId) {
  if (isAdmin(user)) return;
  if (user.role !== "technician") throw forbidden("Only the technician can manage their own records.");
  const profile = await ownProfile(user);
  if (!profile || profile._id !== technicianId) throw forbidden("You can only add records to your own profile.");
}

async function requireTechnicianExists(id) {
  if (!(await TechnicianProfile.exists({ _id: id }))) {
    throw validationError({ technician: `Invalid pk "${id}" - object does not exist.` });
  }
}

const reviewBody = (value, fallback = "") => (typeof value === "string" ? value : fallback);

// ---- technician profiles -------------------------------------------------------

const PROFILE_SPEC = {
  contractor: { type: "fk", nullable: true },
  service_area: { type: "string", blank: true, maxLength: 120 },
  years_experience: { type: "int", min: 0 },
  available: { type: "bool" },
  bio: { type: "string", blank: true },
};

router.get("/technicians", async (req, res) => {
  const filter = allOf(
    await technicianProfileScope(req.user),
    filtersFrom(req, { contractor: ["contractor", "int"], available: ["available", "bool"] }),
  );
  res.json(
    await paginate(req, {
      model: TechnicianProfile,
      filter,
      build: (skip, limit) => TechnicianProfile.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      present: presentTechnicians,
    })
  );
});

router.get("/technicians/me", async (req, res) => {
  const profile = await ownProfile(req.user);
  if (!profile) throw notFound("No technician profile for this account.");
  res.json((await presentTechnicians([profile]))[0]);
});

router.get("/technicians/:id", async (req, res) => {
  res.json((await presentTechnicians([await getScoped(TechnicianProfile, req, await technicianProfileScope(req.user))]))[0]);
});

async function updateProfile(req, res, partial) {
  const profile = await getScoped(TechnicianProfile, req, await technicianProfileScope(req.user));
  // Profiles belong to their technician; admins can step in. Nobody else edits them.
  if (!isAdmin(req.user) && profile.user !== req.user._id) throw forbidden("You can only edit your own profile.");
  const data = validateBody(req.body, PROFILE_SPEC, { partial });
  if (req.user.role === "technician" && data.contractor !== undefined && data.contractor !== profile.contractor) {
    throw forbidden("Only contractor managers can change company membership.");
  }
  if (data.contractor && !(await ContractorCompany.exists({ _id: data.contractor }))) {
    throw validationError({ contractor: `Invalid pk "${data.contractor}" - object does not exist.` });
  }
  const updated = await TechnicianProfile.findByIdAndUpdate(profile._id, data, { new: true }).lean();
  res.json((await presentTechnicians([updated]))[0]);
}
router.put("/technicians/:id", (req, res) => updateProfile(req, res, false));
router.patch("/technicians/:id", (req, res) => updateProfile(req, res, true));

// ---- credentials ---------------------------------------------------------------

const CREDENTIAL_SPEC = {
  technician: { type: "fk", required: true },
  name: { type: "string", required: true, maxLength: 200 },
  issuer_name: { type: "string", required: true, maxLength: 200 },
  credential_number: { type: "string", blank: true, maxLength: 100, default: "" },
  issue_date: { type: "date", nullable: true, default: null },
  expiry_date: { type: "date", nullable: true, default: null },
};

// Multipart forms send empty strings for blank optional fields.
const blankToNull = (body) => {
  const copy = { ...body };
  for (const key of ["issue_date", "expiry_date"]) if (copy[key] === "") copy[key] = null;
  return copy;
};

router.get("/credentials", async (req, res) => {
  const filter = allOf((await technicianScope(req.user)), filtersFrom(req, { technician: ["technician", "int"], status: "status" }));
  res.json(
    await paginate(req, {
      model: Credential,
      filter,
      build: (skip, limit) => Credential.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: (rows) => presentCredentials(rows, req),
    })
  );
});

router.post("/credentials", multipart.single("file"), async (req, res) => {
  const data = validateBody(blankToNull(req.body), CREDENTIAL_SPEC);
  if (!req.file) throw validationError({ file: "No file was submitted." });
  if (req.file.size > MAX_FILE_BYTES || !ocr.detectMediaType(req.file.buffer)) {
    throw validationError({ file: "Upload a PDF or JPEG, PNG, GIF or WebP image no larger than 1 MB." });
  }
  await requireTechnicianExists(data.technician);
  await assertCanWriteTechnicianData(req.user, data.technician);

  const file = await storeUpload("credentials", req.file);
  const credential = await Credential.create({ ...data, file });
  res.status(201).json((await presentCredentials([credential.toObject()], req))[0]);
});

// Registered before "/credentials/:id" so "extract" is not read as an id.
router.post("/credentials/extract", limiter("credential_ocr"), multipart.single("file"), async (req, res) => {
  if (req.user.role !== "technician") throw forbidden("Only technicians can scan their own credentials.");
  if (!req.file) throw new ApiError(400, { detail: "Attach a file to scan." });
  if (req.file.size > MAX_FILE_BYTES) throw new ApiError(400, { detail: "That file is too large to scan (limit 1 MB)." });

  const mediaType = ocr.detectMediaType(req.file.buffer);
  if (!mediaType) throw new ApiError(400, { detail: "Upload a PDF or a JPEG, PNG, GIF or WebP image." });

  try {
    res.json(await ocr.extractCredentialFields(req.file.buffer, mediaType));
  } catch (error) {
    if (error instanceof ocr.OcrUnavailable) throw new ApiError(503, { detail: error.message });
    if (error instanceof ocr.OcrFailed) throw new ApiError(502, { detail: error.message });
    throw error;
  }
});

router.get("/credentials/:id", async (req, res) => {
  const credential = await getScoped(Credential, req, await technicianScope(req.user));
  res.json((await presentCredentials([credential], req))[0]);
});

async function updateCredential(req, res, partial) {
  const credential = await getScoped(Credential, req, await technicianScope(req.user));
  await assertCanWriteTechnicianData(req.user, credential.technician);
  const spec = { ...CREDENTIAL_SPEC };
  const data = validateBody(blankToNull(req.body), spec, { partial });
  if (data.technician !== undefined && data.technician !== credential.technician) {
    await requireTechnicianExists(data.technician);
    await assertCanWriteTechnicianData(req.user, data.technician);
  }
  if (req.file) {
    if (req.file.size > MAX_FILE_BYTES || !ocr.detectMediaType(req.file.buffer)) {
      throw validationError({ file: "Upload a PDF or JPEG, PNG, GIF or WebP image no larger than 1 MB." });
    }
    data.file = await storeUpload("credentials", req.file);
  }
  const updated = await Credential.findByIdAndUpdate(credential._id, data, { new: true }).lean();
  res.json((await presentCredentials([updated], req))[0]);
}
router.put("/credentials/:id", multipart.single("file"), (req, res) => updateCredential(req, res, false));
router.patch("/credentials/:id", multipart.single("file"), (req, res) => updateCredential(req, res, true));

router.delete("/credentials/:id", async (req, res) => {
  const credential = await getScoped(Credential, req, await technicianScope(req.user));
  await assertCanWriteTechnicianData(req.user, credential.technician);
  await Credential.deleteOne({ _id: credential._id });
  res.status(204).end();
});

/** Admin: have the model read the stored document and flag mismatches. */
router.post("/credentials/:id/ai-check", async (req, res) => {
  if (!isAdmin(req.user)) throw forbidden("Only admins can run an AI check.");
  const credential = await getScoped(Credential, req, await technicianScope(req.user));

  const data = await readUpload(credential.file);
  if (!data) throw new ApiError(400, { detail: "The stored document file could not be read." });
  const mediaType = ocr.detectMediaType(data);
  if (!mediaType) throw new ApiError(400, { detail: "The stored file isn't a PDF or a supported image." });

  let extracted;
  try {
    extracted = await ocr.extractCredentialFields(data, mediaType);
  } catch (error) {
    if (error instanceof ocr.OcrUnavailable) throw new ApiError(503, { detail: error.message });
    if (error instanceof ocr.OcrFailed) throw new ApiError(502, { detail: error.message });
    throw error;
  }

  const owner = await User.findById((await TechnicianProfile.findById(credential.technician).lean()).user).lean();
  const flags = ocr.compareExtraction(extracted, credential, fullNameOf(owner));
  const updated = await Credential.findByIdAndUpdate(
    credential._id,
    { ai_check: { checked_at: new Date().toISOString(), model: config.ocrModel, extracted, flags } },
    { new: true }
  ).lean();
  await recordAudit(req.user, "credential.ai_check", "Credential", credential._id, { flags: flags.length });
  res.json((await presentCredentials([updated], req))[0]);
});

// Admin-only by design: unlike capabilities, contractor managers don't
// self-verify credentials. Issuer-backed documents stay a human admin review.
router.post("/credentials/:id/verify", async (req, res) => {
  if (!isAdmin(req.user)) throw forbidden("Only admins can review credentials.");
  const credential = await getScoped(Credential, req, await technicianScope(req.user));
  const status = req.body?.status;
  if (!C.CredentialStatus.values.includes(status)) return res.status(400).json({ detail: "Invalid status." });

  const updated = await Credential.findByIdAndUpdate(
    credential._id,
    {
      status,
      notes: req.body?.notes !== undefined ? reviewBody(req.body.notes, credential.notes) : credential.notes,
      reviewed_by: req.user._id,
      reviewed_at: new Date(),
    },
    { new: true }
  ).lean();
  await recordAudit(req.user, `credential.${status}`, "Credential", credential._id);

  const owner = await TechnicianProfile.findById(credential.technician).lean();
  await notify(owner?.user, "credential", `Credential ${C.CredentialStatus.label(status).toLowerCase()}`, credential.name, "/credentials");
  res.json((await presentCredentials([updated], req))[0]);
});

// ---- capabilities --------------------------------------------------------------

const CAPABILITY_SPEC = {
  technician: { type: "fk", required: true },
  capability_type: { type: "choice", required: true, choices: C.CapabilityType.values },
  equipment_category: { type: "string", blank: true, default: "" },
  refrigerant_type: { type: "fk", nullable: true, default: null },
  safety_domain: { type: "string", blank: true, default: "" },
  evidence_type: { type: "choice", choices: C.EvidenceType.values, default: "none" },
  note: { type: "string", blank: true, maxLength: 300, default: "" },
};

function emptyToDefault(body) {
  const copy = { ...body };
  if (copy.refrigerant_type === "") copy.refrigerant_type = null;
  return copy;
}

/** The three target fields are mutually exclusive; check the one that capability_type requires and reject duplicates. */
async function validateCapability(merged, existingId = null) {
  const { capability_type: type, equipment_category: category, refrigerant_type: refrigerant, safety_domain: domain } = merged;

  if (type === "equipment" && !category) throw validationError({ equipment_category: "Required for equipment capabilities." });
  if (type === "refrigerant" && !refrigerant) throw validationError({ refrigerant_type: "Required for refrigerant capabilities." });
  if (type === "safety" && !domain) throw validationError({ safety_domain: "Required for safety capabilities." });

  if (category && !C.EquipmentCategory.values.includes(category)) {
    throw validationError({ equipment_category: `"${category}" is not a valid choice.` });
  }
  if (domain && !C.SafetyDomain.values.includes(domain)) {
    throw validationError({ safety_domain: `"${domain}" is not a valid choice.` });
  }
  if (refrigerant && !(await RefrigerantType.exists({ _id: refrigerant }))) {
    throw validationError({ refrigerant_type: `Invalid pk "${refrigerant}" - object does not exist.` });
  }

  const duplicate = await CapabilitySkill.exists({
    technician: merged.technician,
    capability_type: type,
    equipment_category: category || "",
    refrigerant_type: refrigerant ?? null,
    safety_domain: domain || "",
    ...(existingId ? { _id: { $ne: existingId } } : {}),
  });
  if (duplicate) {
    throw new ApiError(400, { non_field_errors: ["This capability has already been declared for this technician."] });
  }
}

router.get("/capabilities", async (req, res) => {
  const filter = allOf(
    (await technicianScope(req.user)),
    filtersFrom(req, { technician: ["technician", "int"], capability_type: "capability_type", status: "status" }),
  );
  res.json(
    await paginate(req, {
      model: CapabilitySkill,
      filter,
      build: (skip, limit) => CapabilitySkill.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      present: presentCapabilities,
    })
  );
});

router.post("/capabilities", async (req, res) => {
  const data = validateBody(emptyToDefault(req.body), CAPABILITY_SPEC);
  await requireTechnicianExists(data.technician);
  await assertCanWriteTechnicianData(req.user, data.technician);
  await validateCapability(data);
  const created = await CapabilitySkill.create(data);
  res.status(201).json((await presentCapabilities([created.toObject()]))[0]);
});

router.get("/capabilities/:id", async (req, res) => {
  const skill = await getScoped(CapabilitySkill, req, await technicianScope(req.user));
  res.json((await presentCapabilities([skill]))[0]);
});

async function updateCapability(req, res, partial) {
  const skill = await getScoped(CapabilitySkill, req, await technicianScope(req.user));
  await assertCanWriteTechnicianData(req.user, skill.technician);
  const data = validateBody(emptyToDefault(req.body), CAPABILITY_SPEC, { partial });
  const merged = { ...skill, ...data };
  await validateCapability(merged, skill._id);
  if (data.technician !== undefined && data.technician !== skill.technician) {
    await requireTechnicianExists(data.technician);
    await assertCanWriteTechnicianData(req.user, data.technician);
  }
  // Editing a declared capability sends it back for re-verification, unless a verifier is the one editing.
  if (req.user.role === "technician") Object.assign(data, { status: "pending", verified_by: null, verified_at: null });
  const updated = await CapabilitySkill.findByIdAndUpdate(skill._id, data, { new: true }).lean();
  res.json((await presentCapabilities([updated]))[0]);
}
router.put("/capabilities/:id", (req, res) => updateCapability(req, res, false));
router.patch("/capabilities/:id", (req, res) => updateCapability(req, res, true));

router.delete("/capabilities/:id", async (req, res) => {
  const skill = await getScoped(CapabilitySkill, req, await technicianScope(req.user));
  await assertCanWriteTechnicianData(req.user, skill.technician);
  await CapabilitySkill.deleteOne({ _id: skill._id });
  res.status(204).end();
});

router.post("/capabilities/:id/verify", async (req, res) => {
  const skill = await getScoped(CapabilitySkill, req, await technicianScope(req.user));
  const profile = await TechnicianProfile.findById(skill.technician).lean();
  const company = profile?.contractor ? await ContractorCompany.findById(profile.contractor).lean() : null;
  const canVerify = isAdmin(req.user) || (req.user.role === "contractor_manager" && company && company.manager === req.user._id);
  if (!canVerify) throw forbidden("You are not authorized to verify this capability.");

  const status = req.body?.status;
  if (!C.CapabilityStatus.values.includes(status)) return res.status(400).json({ detail: "Invalid status." });

  const note = req.body?.note !== undefined ? reviewBody(req.body.note, skill.note).slice(0, 300) : skill.note;
  const updated = await CapabilitySkill.findByIdAndUpdate(
    skill._id,
    { status, note, verified_by: req.user._id, verified_at: new Date() },
    { new: true }
  ).lean();
  await recordAudit(req.user, "capability.verify", "CapabilitySkill", skill._id, { new_status: status });
  await notify(profile?.user, "credential", `Capability ${C.CapabilityStatus.label(status).toLowerCase()}`, note, "/capabilities");
  res.json((await presentCapabilities([updated]))[0]);
});

// ---- work history --------------------------------------------------------------

const WORK_SPEC = {
  technician: { type: "fk", required: true },
  equipment_category: { type: "choice", required: true, choices: C.EquipmentCategory.values },
  refrigerant_type: { type: "fk", nullable: true, default: null },
  job: { type: "fk", nullable: true, default: null },
  description: { type: "string", required: true, maxLength: 300 },
  date: { type: "date", required: true },
};

async function workReferences(data) {
  if (data.refrigerant_type && !(await RefrigerantType.exists({ _id: data.refrigerant_type }))) {
    throw validationError({ refrigerant_type: `Invalid pk "${data.refrigerant_type}" - object does not exist.` });
  }
  if (data.job && !(await JobRequest.exists({ _id: data.job }))) {
    throw validationError({ job: `Invalid pk "${data.job}" - object does not exist.` });
  }
}

router.get("/work-history", async (req, res) => {
  const filter = allOf(
    (await technicianScope(req.user)),
    filtersFrom(req, { technician: ["technician", "int"], equipment_category: "equipment_category" }),
  );
  res.json(
    await paginate(req, {
      model: WorkHistoryEntry,
      filter,
      build: (skip, limit) => WorkHistoryEntry.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: presentWorkHistory,
    })
  );
});

router.post("/work-history", async (req, res) => {
  const data = validateBody(req.body, WORK_SPEC);
  await requireTechnicianExists(data.technician);
  await assertCanWriteTechnicianData(req.user, data.technician);
  await workReferences(data);
  const created = await WorkHistoryEntry.create(data);
  res.status(201).json((await presentWorkHistory([created.toObject()]))[0]);
});

router.get("/work-history/:id", async (req, res) => {
  const entry = await getScoped(WorkHistoryEntry, req, await technicianScope(req.user));
  res.json((await presentWorkHistory([entry]))[0]);
});

async function updateWork(req, res, partial) {
  const entry = await getScoped(WorkHistoryEntry, req, await technicianScope(req.user));
  await assertCanWriteTechnicianData(req.user, entry.technician);
  const data = validateBody(req.body, WORK_SPEC, { partial });
  await workReferences(data);
  const updated = await WorkHistoryEntry.findByIdAndUpdate(entry._id, data, { new: true }).lean();
  res.json((await presentWorkHistory([updated]))[0]);
}
router.put("/work-history/:id", (req, res) => updateWork(req, res, false));
router.patch("/work-history/:id", (req, res) => updateWork(req, res, true));

router.delete("/work-history/:id", async (req, res) => {
  const entry = await getScoped(WorkHistoryEntry, req, await technicianScope(req.user));
  await assertCanWriteTechnicianData(req.user, entry.technician);
  await WorkHistoryEntry.deleteOne({ _id: entry._id });
  res.status(204).end();
});

// ---- public verification (no sign-in) ------------------------------------------

/**
 * Deliberately shows only verified truth: no pending items and no contact
 * details beyond a name, since anyone with the link can view it.
 */
const byToken = (token) => TechnicianProfile.findOne({ public_token: String(token).toLowerCase() }).lean();

router.get("/public/technicians/:token", async (req, res) => {
  const technician = await byToken(req.params.token);
  if (!technician) throw notFound();
  const [{ capabilities, credentials }, { displayName, contractor }] = await Promise.all([
    verifiedFacts(technician),
    passportContext(technician),
  ]);
  res.json({
    full_name: displayName,
    contractor_name: contractor ? contractor.name : null,
    years_experience: technician.years_experience,
    verified_capabilities: capabilities.map((c) => ({ ...c, verified_at: c.verified_at?.toISOString?.() ?? null })),
    verified_credentials: credentials,
  });
});

router.get("/public/technicians/:token/qr", async (req, res) => {
  const technician = await byToken(req.params.token);
  if (!technician) throw notFound();
  const png = await QRCode.toBuffer(`${config.frontendUrl}/verify/${technician.public_token}`, { type: "png", margin: 2, width: 400 });
  res.type("image/png").send(png);
});

router.get("/public/technicians/:token/passport.pdf", async (req, res) => {
  const technician = await byToken(req.params.token);
  if (!technician) throw notFound();
  const { bytes } = await renderPassportPdf(technician);
  sendPdf(res, bytes, `thermatrust-passport-${technician.public_token}.pdf`);
});

/** Tells whoever scanned a printed passport whether its records still hold. */
router.get("/public/technicians/:token/passport/verify", async (req, res) => {
  const technician = await byToken(req.params.token);
  if (!technician) throw notFound();
  const supplied = String(req.query.hash ?? "").trim().toLowerCase();
  if (!supplied) throw new ApiError(400, { detail: "Provide the passport's hash." });

  const [digest, context] = await Promise.all([passportDigest(technician), passportContext(technician)]);
  res.json({ valid: constantTimeEqual(supplied, digest), full_name: context.displayName });
});

export default router;
