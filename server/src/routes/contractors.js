import { Router } from "express";
import * as C from "../lib/choices.js";
import { forbidden, notFound, validationError } from "../lib/errors.js";
import { getScoped, requireAdmin } from "../lib/http.js";
import { allOf, filtersFrom, paginate } from "../lib/pagination.js";
import { validateBody } from "../lib/validate.js";
import { authenticate } from "../middleware/auth.js";
import { MAX_FILE_BYTES, multipart, storeUpload } from "../middleware/upload.js";
import {
  CapabilitySkill, ContractorCompany, ContractorDocument, TechnicianProfile, isAdmin,
} from "../models/index.js";
import { presentContractorDocuments, presentContractors, presentTechnicians } from "../presenters.js";
import { recordAudit } from "../services/audit.js";
import { computeCompliance } from "../services/compliance.js";
import { detectMediaType } from "../services/ocr.js";

const router = Router();
router.use("/contractors", authenticate);
router.use("/contractor-documents", authenticate);

const COMPANY_SPEC = {
  name: { type: "string", required: true, maxLength: 200 },
  registration_number: { type: "string", blank: true, maxLength: 100, default: "" },
  service_area: { type: "string", required: true, maxLength: 120 },
  response_time_commitment: { type: "string", blank: true, maxLength: 100, default: "" },
};

const companyScope = (user) => (user.role === "contractor_manager" ? { manager: user._id } : {});

/** Only the managing contractor (or an admin) may change a company or what hangs off it. */
function assertManages(user, company) {
  if (isAdmin(user)) return;
  if (user.role === "contractor_manager" && company.manager === user._id) return;
  throw forbidden("You do not manage this contractor company.");
}

router.get("/contractors", async (req, res) => {
  const filter = allOf(companyScope(req.user), filtersFrom(req, { verification_status: "verification_status" }));
  res.json(
    await paginate(req, {
      model: ContractorCompany,
      filter,
      build: (skip, limit) => ContractorCompany.find(filter).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: presentContractors,
    })
  );
});

router.post("/contractors", async (req, res) => {
  if (req.user.role !== "contractor_manager" && !isAdmin(req.user)) {
    throw forbidden("Only contractor managers can register a company.");
  }
  const data = validateBody(req.body, COMPANY_SPEC);
  const company = await ContractorCompany.create({ ...data, manager: req.user._id });
  res.status(201).json((await presentContractors([company.toObject()]))[0]);
});

router.get("/contractors/:id", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  res.json((await presentContractors([company]))[0]);
});

async function updateCompany(req, res, partial) {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  assertManages(req.user, company);
  const data = validateBody(req.body, COMPANY_SPEC, { partial });
  const updated = await ContractorCompany.findByIdAndUpdate(company._id, data, { new: true }).lean();
  res.json((await presentContractors([updated]))[0]);
}
router.put("/contractors/:id", (req, res) => updateCompany(req, res, false));
router.patch("/contractors/:id", (req, res) => updateCompany(req, res, true));

router.delete("/contractors/:id", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  assertManages(req.user, company);
  await TechnicianProfile.updateMany({ contractor: company._id }, { contractor: null });
  await ContractorDocument.deleteMany({ company: company._id });
  await ContractorCompany.deleteOne({ _id: company._id });
  res.status(204).end();
});

router.get("/contractors/:id/technicians", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  const roster = await TechnicianProfile.find({ contractor: company._id }).lean();
  res.json(await presentTechnicians(roster));
});

router.get("/contractors/:id/compliance", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  res.json(await computeCompliance(company));
});

router.get("/contractors/:id/pending-approvals", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  const roster = await TechnicianProfile.find({ contractor: company._id }, { _id: 1 }).lean();
  const pending = roster.length
    ? await CapabilitySkill.countDocuments({ technician: { $in: roster.map((t) => t._id) }, status: "pending" })
    : 0;
  res.json({ pending_capabilities: pending });
});

router.post("/contractors/:id/add-technician", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  assertManages(req.user, company);
  const technician = Number.isInteger(req.body?.technician_id) || /^\d+$/.test(String(req.body?.technician_id))
    ? await TechnicianProfile.findById(Number(req.body.technician_id)).lean()
    : null;
  if (!technician) throw notFound("Technician not found.");
  const updated = await TechnicianProfile.findByIdAndUpdate(technician._id, { contractor: company._id }, { new: true }).lean();
  res.json((await presentTechnicians([updated]))[0]);
});

router.post("/contractors/:id/remove-technician", async (req, res) => {
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  assertManages(req.user, company);
  const id = Number(req.body?.technician_id);
  if (Number.isInteger(id)) await TechnicianProfile.updateOne({ _id: id, contractor: company._id }, { contractor: null });
  res.status(204).end();
});

router.post("/contractors/:id/verify", async (req, res) => {
  requireAdmin(req.user);
  const company = await getScoped(ContractorCompany, req, companyScope(req.user));
  const status = req.body?.verification_status;
  if (!C.ContractorVerificationStatus.values.includes(status)) {
    return res.status(400).json({ detail: "Invalid status." });
  }
  const updated = await ContractorCompany.findByIdAndUpdate(company._id, { verification_status: status }, { new: true }).lean();
  await recordAudit(req.user, `contractor.${status}`, "ContractorCompany", company._id);
  res.json((await presentContractors([updated]))[0]);
});

// ---- documents ----------------------------------------------------------------

const DOCUMENT_SPEC = {
  company: { type: "fk", required: true },
  doc_type: { type: "choice", required: true, choices: C.ContractorDocType.values },
};

async function documentScope(user) {
  if (user.role !== "contractor_manager") return {};
  const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
  return { company: { $in: companies.map((c) => c._id) } };
}

router.get("/contractor-documents", async (req, res) => {
  const filter = allOf(
    (await documentScope(req.user)),
    filtersFrom(req, { company: ["company", "int"], doc_type: "doc_type", status: "status" }),
  );
  res.json(
    await paginate(req, {
      model: ContractorDocument,
      filter,
      build: (skip, limit) => ContractorDocument.find(filter).sort({ uploaded_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      present: (rows) => presentContractorDocuments(rows, req),
    })
  );
});

router.post("/contractor-documents", multipart.single("file"), async (req, res) => {
  const data = validateBody(req.body, DOCUMENT_SPEC);
  if (!req.file) throw validationError({ file: "No file was submitted." });
  if (req.file.size > MAX_FILE_BYTES || !detectMediaType(req.file.buffer)) {
    throw validationError({ file: "Upload a PDF or JPEG, PNG, GIF or WebP image no larger than 1 MB." });
  }
  const company = await ContractorCompany.findById(data.company).lean();
  if (!company) throw validationError({ company: `Invalid pk "${data.company}" - object does not exist.` });
  assertManages(req.user, company);

  const file = await storeUpload("contractor_documents", req.file);
  const document = await ContractorDocument.create({ company: company._id, doc_type: data.doc_type, file });
  res.status(201).json((await presentContractorDocuments([document.toObject()], req))[0]);
});

router.get("/contractor-documents/:id", async (req, res) => {
  const document = await getScoped(ContractorDocument, req, await documentScope(req.user));
  res.json((await presentContractorDocuments([document], req))[0]);
});

router.delete("/contractor-documents/:id", async (req, res) => {
  const document = await getScoped(ContractorDocument, req, await documentScope(req.user));
  const company = await ContractorCompany.findById(document.company).lean();
  assertManages(req.user, company);
  await ContractorDocument.deleteOne({ _id: document._id });
  res.status(204).end();
});

router.post("/contractor-documents/:id/verify", async (req, res) => {
  requireAdmin(req.user);
  const document = await getScoped(ContractorDocument, req, await documentScope(req.user));
  const status = req.body?.status;
  if (!C.ContractorDocStatus.values.includes(status)) return res.status(400).json({ detail: "Invalid status." });
  const updated = await ContractorDocument.findByIdAndUpdate(document._id, { status }, { new: true }).lean();
  await recordAudit(req.user, `contractor_document.${status}`, "ContractorDocument", document._id);
  res.json((await presentContractorDocuments([updated], req))[0]);
});

export default router;
