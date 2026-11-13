import {
  Credential, Equipment, Facility, JobAssignment, JobRequest, RefrigerantCylinder, RefrigerantType,
  TechnicianProfile, User, ContractorCompany, byId, fullNameOf, isAdmin,
} from "../models/index.js";
import * as C from "../lib/choices.js";
import { num } from "../lib/decimal.js";

/** Cross-record search for the command palette, scoped to what the caller may see. */
const LIMIT = 5;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (q) => new RegExp(escapeRegex(q), "i");
const any = (q, ...fields) => ({ $or: fields.map((field) => ({ [field]: contains(q) })) });

async function facilityManager(user, q) {
  const facilities = await Facility.find({ owner: user._id }).lean();
  const ids = facilities.map((f) => f._id);
  const out = [];

  for (const f of facilities.filter((f) => contains(q).test(f.name) || contains(q).test(f.address)).slice(0, LIMIT)) {
    out.push({ type: "facility", id: f._id, title: f.name, subtitle: f.address, link: `/facilities/${f._id}` });
  }
  if (!ids.length) return out;

  const facilityById = new Map(facilities.map((f) => [f._id, f]));
  const refrigerants = await RefrigerantType.find({ code: contains(q) }, { _id: 1 }).lean();
  const equipment = await Equipment.find({
    facility: { $in: ids },
    $or: [{ name: contains(q) }, { refrigerant_type: { $in: refrigerants.map((r) => r._id) } }],
  })
    .limit(LIMIT)
    .lean();
  const refrigerantBy = await byId(RefrigerantType, equipment.map((e) => e.refrigerant_type));
  for (const e of equipment) {
    out.push({
      type: "equipment", id: e._id, title: e.name,
      subtitle: `${facilityById.get(e.facility).name} - ${refrigerantBy.get(e.refrigerant_type)?.code ?? ""}`,
      link: `/equipment/${e._id}`,
    });
  }

  const matchingEquipment = await Equipment.find({ facility: { $in: ids }, name: contains(q) }, { _id: 1 }).lean();
  const jobs = await JobRequest.find({
    facility: { $in: ids },
    $or: [{ description: contains(q) }, { equipment: { $in: matchingEquipment.map((e) => e._id) } }],
  })
    .sort({ created_at: -1 })
    .limit(LIMIT)
    .lean();
  const jobEquipment = await byId(Equipment, jobs.map((j) => j.equipment));
  for (const j of jobs) {
    const subtitle = `${C.JobStatus.label(j.status)} - ${j.risk_level ? C.RiskLevel.label(j.risk_level) : ""}`.replace(/^[ -]+|[ -]+$/g, "");
    out.push({
      type: "job", id: j._id, title: `Job #${j._id} - ${jobEquipment.get(j.equipment)?.name ?? ""}`,
      subtitle, link: `/jobs/${j._id}`,
    });
  }
  return out;
}

async function technician(user, q) {
  const profile = await TechnicianProfile.findOne({ user: user._id }, { _id: 1 }).lean();
  if (!profile) return [];
  const assignments = await JobAssignment.find({ technician: profile._id }, { job: 1 }).lean();
  if (!assignments.length) return [];
  const jobIds = assignments.map((a) => a.job);

  const [matchingEquipment, matchingFacilities] = await Promise.all([
    Equipment.find({ name: contains(q) }, { _id: 1 }).lean(),
    Facility.find({ name: contains(q) }, { _id: 1 }).lean(),
  ]);
  const jobs = await JobRequest.find({
    _id: { $in: jobIds },
    $or: [
      { description: contains(q) },
      { equipment: { $in: matchingEquipment.map((e) => e._id) } },
      { facility: { $in: matchingFacilities.map((f) => f._id) } },
    ],
  })
    .limit(LIMIT)
    .lean();
  const [equipmentBy, facilityBy] = await Promise.all([
    byId(Equipment, jobs.map((j) => j.equipment)),
    byId(Facility, jobs.map((j) => j.facility)),
  ]);
  return jobs.map((j) => ({
    type: "job", id: j._id, title: `Job #${j._id} - ${equipmentBy.get(j.equipment)?.name ?? ""}`,
    subtitle: facilityBy.get(j.facility)?.name ?? "", link: `/my-jobs/${j._id}/report`,
  }));
}

async function contractor(user, q) {
  const companies = await ContractorCompany.find({ manager: user._id }, { _id: 1 }).lean();
  const companyIds = companies.map((c) => c._id);
  if (!companyIds.length) return [];
  const out = [];

  const roster = await TechnicianProfile.find({ contractor: { $in: companyIds } }).lean();
  const users = await byId(User, roster.map((t) => t.user));
  for (const profile of roster) {
    const u = users.get(profile.user);
    if (!u) continue;
    const haystack = `${u.first_name} ${u.last_name} ${u.email}`;
    if (!contains(q).test(haystack)) continue;
    if (out.length >= LIMIT) break;
    out.push({ type: "technician", id: profile._id, title: fullNameOf(u), subtitle: u.email, link: "/roster" });
  }

  const refrigerants = await RefrigerantType.find({ code: contains(q) }, { _id: 1 }).lean();
  const cylinders = await RefrigerantCylinder.find({
    company: { $in: companyIds },
    $or: [{ serial_number: contains(q) }, { refrigerant_type: { $in: refrigerants.map((r) => r._id) } }],
  })
    .limit(LIMIT)
    .lean();
  const refrigerantBy = await byId(RefrigerantType, cylinders.map((c) => c.refrigerant_type));
  for (const c of cylinders) {
    out.push({
      type: "cylinder", id: c._id, title: c.serial_number,
      subtitle: `${refrigerantBy.get(c.refrigerant_type)?.code ?? ""} - ${num(c.current_kg).toFixed(2)} kg`, link: "/cylinders",
    });
  }
  return out;
}

async function admin(q) {
  const matchingUsers = await User.find(any(q, "email", "first_name", "last_name"), { _id: 1 }).lean();
  const matchingTechnicians = await TechnicianProfile.find({ user: { $in: matchingUsers.map((u) => u._id) } }, { _id: 1 }).lean();
  const credentials = await Credential.find({
    $or: [{ name: contains(q) }, { issuer_name: contains(q) }, { technician: { $in: matchingTechnicians.map((t) => t._id) } }],
  })
    .limit(LIMIT)
    .lean();
  const profiles = await byId(TechnicianProfile, credentials.map((c) => c.technician));
  const users = await byId(User, [...profiles.values()].map((p) => p.user));
  return credentials.map((c) => {
    const owner = users.get(profiles.get(c.technician)?.user);
    return {
      type: "credential", id: c._id, title: c.name, subtitle: owner ? fullNameOf(owner) : "", link: "/admin/credentials",
    };
  });
}

export async function search(user, query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  if (user.role === "facility_manager") return facilityManager(user, q);
  if (user.role === "technician") return technician(user, q);
  if (user.role === "contractor_manager") return contractor(user, q);
  if (isAdmin(user)) return admin(q);
  return [];
}
