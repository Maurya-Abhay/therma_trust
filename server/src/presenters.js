import {
  AssessmentQuestion, ContractorCompany, Equipment, Facility, JobAssignment, JobFeedback, RefrigerantCylinder,
  RefrigerantType, ServiceReport, ServiceReportPhoto, TechnicianProfile, User, byId, fullNameOf, isAdmin,
} from "./models/index.js";
import * as C from "./lib/choices.js";
import { money2 } from "./lib/decimal.js";
import { fileUrl, timestamp } from "./lib/http.js";
import { detectDriftBatch } from "./services/drift.js";
import { effectiveCredentialStatus } from "./services/compliance.js";
import { capabilityLabel } from "./services/passport.js";

/**
 * Turn stored records into the JSON the web app reads. Each present* function
 * takes a page of lean rows and loads whatever related records it needs in
 * bulk, so a list costs a handful of queries, not one per row.
 */

export const presentUser = (u) => ({
  id: u._id, email: u.email, first_name: u.first_name, last_name: u.last_name, phone: u.phone, role: u.role,
});

export const presentRefrigerant = (r) => ({
  id: r._id, code: r.code, name: r.name, gwp: r.gwp, is_a2l: r.is_a2l, is_ammonia: r.is_ammonia, is_high_pressure: r.is_high_pressure,
});

/** Map(technicianId -> display name) for a set of technician profile ids. */
export async function technicianNames(technicianIds) {
  const profiles = await byId(TechnicianProfile, technicianIds);
  const users = await byId(User, [...profiles.values()].map((p) => p.user));
  const names = new Map();
  for (const [id, profile] of profiles) names.set(id, users.has(profile.user) ? fullNameOf(users.get(profile.user)) : "");
  return names;
}

// ---- facilities / equipment ---------------------------------------------------

export async function presentFacilities(rows) {
  const counts = rows.length
    ? await Equipment.aggregate([
        { $match: { facility: { $in: rows.map((r) => r._id) } } },
        { $group: { _id: "$facility", count: { $sum: 1 } } },
      ])
    : [];
  const countBy = new Map(counts.map((c) => [c._id, c.count]));
  return rows.map((f) => ({
    id: f._id, owner: f.owner, name: f.name, segment: f.segment, address: f.address, service_area: f.service_area,
    contact_name: f.contact_name, contact_phone: f.contact_phone, equipment_count: countBy.get(f._id) ?? 0,
    created_at: timestamp(f.created_at),
  }));
}

export async function presentEquipment(rows) {
  const [refrigerants, drift] = await Promise.all([
    byId(RefrigerantType, rows.map((r) => r.refrigerant_type)),
    detectDriftBatch(rows.map((r) => r._id)),
  ]);
  return rows.map((e) => ({
    id: e._id, facility: e.facility, name: e.name, category: e.category, category_display: C.EquipmentCategory.label(e.category),
    refrigerant_type: e.refrigerant_type, refrigerant_type_code: refrigerants.get(e.refrigerant_type)?.code ?? null,
    capacity: e.capacity, refrigerant_charge_kg: money2(e.refrigerant_charge_kg), criticality: e.criticality,
    install_date: e.install_date, created_at: timestamp(e.created_at), drift_warnings: drift.get(e._id) ?? [],
  }));
}

// ---- contractors ---------------------------------------------------------------

export async function presentContractors(rows) {
  const counts = rows.length
    ? await TechnicianProfile.aggregate([
        { $match: { contractor: { $in: rows.map((r) => r._id) } } },
        { $group: { _id: "$contractor", count: { $sum: 1 } } },
      ])
    : [];
  const countBy = new Map(counts.map((c) => [c._id, c.count]));
  return rows.map((c) => ({
    id: c._id, manager: c.manager, name: c.name, registration_number: c.registration_number, service_area: c.service_area,
    response_time_commitment: c.response_time_commitment, verification_status: c.verification_status,
    technician_count: countBy.get(c._id) ?? 0, created_at: timestamp(c.created_at),
  }));
}

export async function presentContractorDocuments(rows, req) {
  const companies = await byId(ContractorCompany, rows.map((r) => r.company));
  return rows.map((d) => ({
    id: d._id, company: d.company, company_name: companies.get(d.company)?.name ?? "", doc_type: d.doc_type,
    file: fileUrl(req, d.file), status: d.status, uploaded_at: timestamp(d.uploaded_at),
  }));
}

// ---- technicians ---------------------------------------------------------------

async function ratingStats(technicianIds) {
  const stats = new Map();
  if (!technicianIds.length) return stats;
  const assignments = await JobAssignment.find({ technician: { $in: technicianIds } }, { job: 1, technician: 1 }).lean();
  if (!assignments.length) return stats;
  const technicianByJob = new Map(assignments.map((a) => [a.job, a.technician]));
  const feedback = await JobFeedback.find({ job: { $in: [...technicianByJob.keys()] } }, { job: 1, rating: 1 }).lean();
  for (const row of feedback) {
    const technician = technicianByJob.get(row.job);
    const current = stats.get(technician) ?? { sum: 0, count: 0 };
    current.sum += row.rating;
    current.count += 1;
    stats.set(technician, current);
  }
  return stats;
}

export async function presentTechnicians(rows) {
  const [users, contractors, ratings] = await Promise.all([
    byId(User, rows.map((r) => r.user)),
    byId(ContractorCompany, rows.map((r) => r.contractor)),
    ratingStats(rows.map((r) => r._id)),
  ]);
  return rows.map((t) => {
    const user = users.get(t.user);
    const rating = ratings.get(t._id);
    return {
      id: t._id, user: t.user, email: user?.email ?? "", full_name: user ? fullNameOf(user) : "",
      contractor: t.contractor, contractor_name: contractors.get(t.contractor)?.name ?? null,
      service_area: t.service_area, years_experience: t.years_experience, available: t.available, bio: t.bio,
      public_token: t.public_token,
      average_rating: rating ? Math.round((rating.sum / rating.count) * 100) / 100 : null,
      rating_count: rating?.count ?? 0,
    };
  });
}

export async function presentCredentials(rows, req) {
  const names = await technicianNames(rows.map((r) => r.technician));
  const showAi = isAdmin(req.user);
  return rows.map((c) => {
    const out = {
      id: c._id, technician: c.technician, technician_name: names.get(c.technician) ?? "", name: c.name,
      issuer_name: c.issuer_name, credential_number: c.credential_number, issue_date: c.issue_date,
      expiry_date: c.expiry_date, file: fileUrl(req, c.file), status: c.status,
      effective_status: effectiveCredentialStatus(c), reviewed_by: c.reviewed_by, reviewed_at: timestamp(c.reviewed_at),
      notes: c.notes, created_at: timestamp(c.created_at),
    };
    // The AI check is an admin's review aid; showing a technician which fields
    // tripped a flag would only teach them to tune around it.
    if (showAi) out.ai_check = c.ai_check ?? null;
    return out;
  });
}

export async function presentCapabilities(rows) {
  const [names, refrigerants] = await Promise.all([
    technicianNames(rows.map((r) => r.technician)),
    byId(RefrigerantType, rows.map((r) => r.refrigerant_type)),
  ]);
  return rows.map((s) => ({
    id: s._id, technician: s.technician, technician_name: names.get(s.technician) ?? "",
    capability_type: s.capability_type, equipment_category: s.equipment_category, refrigerant_type: s.refrigerant_type,
    refrigerant_type_code: refrigerants.get(s.refrigerant_type)?.code ?? null, safety_domain: s.safety_domain,
    evidence_type: s.evidence_type, status: s.status, note: s.note, label: capabilityLabel(s, refrigerants),
    verified_by: s.verified_by, verified_at: timestamp(s.verified_at),
  }));
}

export const presentWorkHistory = async (rows) =>
  rows.map((w) => ({
    id: w._id, technician: w.technician, equipment_category: w.equipment_category, refrigerant_type: w.refrigerant_type,
    job: w.job, description: w.description, date: w.date,
  }));

// ---- jobs ----------------------------------------------------------------------

export const presentFeedback = (f) =>
  f ? { id: f._id, job: f.job, rating: f.rating, comment: f.comment, created_at: timestamp(f.created_at) } : null;

export async function presentAssignments(rows) {
  const names = await technicianNames(rows.map((r) => r.technician));
  return rows.map((a) => ({
    id: a._id, job: a.job, technician: a.technician, technician_name: names.get(a.technician) ?? "",
    assigned_by: a.assigned_by, override_warning: a.override_warning, override_reason: a.override_reason,
    assigned_at: timestamp(a.assigned_at),
  }));
}

export async function presentJobs(rows) {
  const ids = rows.map((r) => r._id);
  const [facilities, equipment, assignments, feedback, drift] = await Promise.all([
    byId(Facility, rows.map((r) => r.facility)),
    byId(Equipment, rows.map((r) => r.equipment)),
    ids.length ? JobAssignment.find({ job: { $in: ids } }).lean() : [],
    ids.length ? JobFeedback.find({ job: { $in: ids } }).lean() : [],
    detectDriftBatch([...new Set(rows.map((r) => r.equipment))]),
  ]);
  const presentedAssignments = await presentAssignments(assignments);
  const assignmentBy = new Map(presentedAssignments.map((a) => [a.job, a]));
  const feedbackBy = new Map(feedback.map((f) => [f.job, f]));

  return rows.map((j) => ({
    id: j._id, facility: j.facility, facility_name: facilities.get(j.facility)?.name ?? "", equipment: j.equipment,
    equipment_name: equipment.get(j.equipment)?.name ?? "", created_by: j.created_by, description: j.description,
    urgency: j.urgency, status: j.status, risk_level: j.risk_level, required_capabilities: j.required_capabilities ?? [],
    assignment: assignmentBy.get(j._id) ?? null, created_at: timestamp(j.created_at),
    equipment_drift_warnings: drift.get(j.equipment) ?? [], scheduled_for: timestamp(j.scheduled_for),
    feedback: presentFeedback(feedbackBy.get(j._id)),
  }));
}

// ---- service reports and cylinders ---------------------------------------------

export async function presentReportPhotos(rows, req) {
  return rows.map((p) => ({ id: p._id, report: p.report, image: fileUrl(req, p.image), caption: p.caption, is_before: p.is_before }));
}

export async function presentReports(rows, req) {
  const ids = rows.map((r) => r._id);
  const [names, refrigerants, cylinders, photos] = await Promise.all([
    technicianNames(rows.map((r) => r.technician)),
    byId(RefrigerantType, rows.map((r) => r.refrigerant_type)),
    byId(RefrigerantCylinder, rows.flatMap((r) => [r.added_from_cylinder, r.recovered_into_cylinder])),
    ids.length ? ServiceReportPhoto.find({ report: { $in: ids } }).sort({ _id: 1 }).lean() : [],
  ]);
  const photosBy = new Map();
  for (const photo of await presentReportPhotos(photos, req)) {
    const list = photosBy.get(photo.report) ?? [];
    list.push(photo);
    photosBy.set(photo.report, list);
  }
  return rows.map((r) => ({
    id: r._id, job: r.job, technician: r.technician, technician_name: names.get(r.technician) ?? "",
    fault_description: r.fault_description, diagnostic_readings: r.diagnostic_readings ?? {},
    refrigerant_type: r.refrigerant_type, refrigerant_code: refrigerants.get(r.refrigerant_type)?.code ?? null,
    refrigerant_added_kg: money2(r.refrigerant_added_kg), refrigerant_recovered_kg: money2(r.refrigerant_recovered_kg),
    added_from_cylinder: r.added_from_cylinder, added_from_cylinder_serial: cylinders.get(r.added_from_cylinder)?.serial_number ?? null,
    recovered_into_cylinder: r.recovered_into_cylinder,
    recovered_into_cylinder_serial: cylinders.get(r.recovered_into_cylinder)?.serial_number ?? null,
    leak_test_result: r.leak_test_result, vacuum_result: r.vacuum_result, parts_replaced: r.parts_replaced,
    safety_checklist: r.safety_checklist ?? {}, summary: r.summary, status: r.status,
    technician_signed_at: timestamp(r.technician_signed_at), facility_approved_by: r.facility_approved_by,
    facility_approved_at: timestamp(r.facility_approved_at), photos: photosBy.get(r._id) ?? [], created_at: timestamp(r.created_at),
  }));
}

export async function presentCylinders(rows) {
  const [refrigerants, companies] = await Promise.all([
    byId(RefrigerantType, rows.map((r) => r.refrigerant_type)),
    byId(ContractorCompany, rows.map((r) => r.company)),
  ]);
  return rows.map((c) => ({
    id: c._id, company: c.company, company_name: companies.get(c.company)?.name ?? "", serial_number: c.serial_number,
    refrigerant_type: c.refrigerant_type, refrigerant_type_code: refrigerants.get(c.refrigerant_type)?.code ?? null,
    kind: c.kind, capacity_kg: money2(c.capacity_kg), current_kg: money2(c.current_kg), created_at: timestamp(c.created_at),
  }));
}

export async function presentTransactions(rows) {
  const reports = await byId(ServiceReport, rows.map((r) => r.service_report), { job: 1, technician: 1 });
  const names = await technicianNames([...reports.values()].map((r) => r.technician));
  return rows.map((t) => {
    const report = reports.get(t.service_report);
    return {
      id: t._id, kind: t.kind, amount_kg: money2(t.amount_kg), balance_after_kg: money2(t.balance_after_kg),
      service_report: t.service_report, job: report?.job ?? null,
      technician_name: report ? names.get(report.technician) ?? null : null, created_at: timestamp(t.created_at),
    };
  });
}

// ---- assessments ---------------------------------------------------------------

function targetLabel(assessment, refrigerants) {
  if (assessment.capability_type === "equipment") return C.EquipmentCategory.label(assessment.equipment_category);
  if (assessment.capability_type === "refrigerant") return refrigerants.get(assessment.refrigerant_type)?.code ?? "?";
  return C.SafetyDomain.label(assessment.safety_domain);
}

export async function presentAssessments(rows) {
  const ids = rows.map((r) => r._id);
  const [refrigerants, questions] = await Promise.all([
    byId(RefrigerantType, rows.map((r) => r.refrigerant_type)),
    ids.length ? AssessmentQuestion.find({ assessment: { $in: ids } }).sort({ order: 1, _id: 1 }).lean() : [],
  ]);
  const questionsBy = new Map();
  for (const q of questions) {
    const list = questionsBy.get(q.assessment) ?? [];
    // correct_index is deliberately left out: the answer key never leaves the server.
    list.push({ id: q._id, prompt: q.prompt, choices: q.choices, order: q.order });
    questionsBy.set(q.assessment, list);
  }
  return rows.map((a) => ({
    id: a._id, title: a.title, capability_type: a.capability_type, equipment_category: a.equipment_category,
    refrigerant_type: a.refrigerant_type, refrigerant_type_code: refrigerants.get(a.refrigerant_type)?.code ?? null,
    safety_domain: a.safety_domain, target_label: targetLabel(a, refrigerants), pass_score_percent: a.pass_score_percent,
    questions: questionsBy.get(a._id) ?? [],
  }));
}

export async function presentAttempts(rows, assessmentsById) {
  return rows.map((a) => ({
    id: a._id, assessment: a.assessment, assessment_title: assessmentsById.get(a.assessment)?.title ?? "",
    technician: a.technician, score_percent: a.score_percent, passed: a.passed, submitted_at: timestamp(a.submitted_at),
  }));
}

