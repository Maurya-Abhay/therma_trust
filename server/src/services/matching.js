import {
  CapabilitySkill, ContractorCompany, Equipment, Facility, TechnicianProfile, User, WorkHistoryEntry,
} from "../models/index.js";

/**
 * Risk-based technician matching.
 *
 * Scores available technicians against a job's required capabilities plus
 * experience, location and contractor-trust signals, and lists exactly which
 * required capabilities each candidate is missing so the app can warn a
 * facility manager before an unsafe assignment.
 */
export const REQUIRED_CAPABILITY_SCORE = 20;
export const PENDING_CAPABILITY_SCORE = 5;
export const WORK_HISTORY_SCORE_PER_ENTRY = 2;
export const WORK_HISTORY_SCORE_CAP = 10;
export const EXPERIENCE_SCORE_CAP = 10;
export const LOCATION_MATCH_SCORE = 10;
export const CONTRACTOR_VERIFIED_SCORE = 10;

const skillKey = (skill) => {
  if (skill.capability_type === "equipment") return `equipment:${skill.equipment_category}`;
  if (skill.capability_type === "refrigerant") return `refrigerant:${skill.refrigerant_type}`;
  return `safety:${skill.safety_domain}`;
};

const requirementKey = (requirement) => `${requirement.capability_type}:${requirement.key}`;

/** Pure scoring. `context` carries what the technician has on file; `job` is a lean job with its equipment and facility. */
export function scoreTechnician(technician, job, context) {
  const { skills, historyCount, contractorVerified } = context;
  const lookup = new Map(skills.map((skill) => [skillKey(skill), skill]));

  let score = 0;
  const missing = [];
  for (const requirement of job.required_capabilities || []) {
    const skill = lookup.get(requirementKey(requirement));
    if (skill && skill.status === "verified") {
      score += REQUIRED_CAPABILITY_SCORE;
    } else if (skill && skill.status === "pending") {
      score += PENDING_CAPABILITY_SCORE;
      missing.push({ ...requirement, reason: "capability pending verification" });
    } else {
      missing.push({ ...requirement, reason: "no verified capability on file" });
    }
  }
  const breakdown = { capability_score: score };

  const historyScore = Math.min(historyCount * WORK_HISTORY_SCORE_PER_ENTRY, WORK_HISTORY_SCORE_CAP);
  score += historyScore;
  breakdown.work_history_score = historyScore;

  const experienceScore = Math.min(technician.years_experience || 0, EXPERIENCE_SCORE_CAP);
  score += experienceScore;
  breakdown.experience_score = experienceScore;

  const facilityArea = (job.facility.service_area || "").trim().toLowerCase();
  const technicianArea = (technician.service_area || "").trim().toLowerCase();
  const locationScore = facilityArea && technicianArea && facilityArea === technicianArea ? LOCATION_MATCH_SCORE : 0;
  score += locationScore;
  breakdown.location_score = locationScore;

  const contractorScore = contractorVerified ? CONTRACTOR_VERIFIED_SCORE : 0;
  score += contractorScore;
  breakdown.contractor_score = contractorScore;

  return { score, breakdown, missing_requirements: missing, is_qualified: missing.length === 0 };
}

/** Attach the equipment and facility the scorer needs to a lean job. */
export async function hydrateJob(job) {
  const [equipment, facility] = await Promise.all([
    Equipment.findById(job.equipment).lean(),
    Facility.findById(job.facility).lean(),
  ]);
  return { ...job, equipmentDoc: equipment, facility };
}

async function contextFor(technicians, equipmentCategory) {
  const ids = technicians.map((t) => t._id);
  const [skills, history, contractors] = await Promise.all([
    CapabilitySkill.find({ technician: { $in: ids } }).lean(),
    WorkHistoryEntry.aggregate([
      { $match: { technician: { $in: ids }, equipment_category: equipmentCategory } },
      { $group: { _id: "$technician", count: { $sum: 1 } } },
    ]),
    ContractorCompany.find({ _id: { $in: technicians.map((t) => t.contractor).filter(Boolean) } }).lean(),
  ]);
  const skillsBy = new Map();
  for (const skill of skills) {
    const list = skillsBy.get(skill.technician) ?? [];
    list.push(skill);
    skillsBy.set(skill.technician, list);
  }
  const historyBy = new Map(history.map((row) => [row._id, row.count]));
  const contractorBy = new Map(contractors.map((c) => [c._id, c]));
  return (technician) => ({
    skills: skillsBy.get(technician._id) ?? [],
    historyCount: historyBy.get(technician._id) ?? 0,
    contractorVerified: contractorBy.get(technician.contractor)?.verification_status === "verified",
  });
}

/** Score one technician against a job (used by assignment to decide whether an override is needed). */
export async function scoreOne(technician, job) {
  const hydrated = await hydrateJob(job);
  const contextOf = await contextFor([technician], hydrated.equipmentDoc.category);
  return scoreTechnician(technician, hydrated, contextOf(technician));
}

/** Every available technician, best first, with display names for the response. */
export async function rankTechnicians(job) {
  const hydrated = await hydrateJob(job);
  const technicians = await TechnicianProfile.find({ available: true }).lean();
  if (!technicians.length) return [];

  const [contextOf, users, contractors] = await Promise.all([
    contextFor(technicians, hydrated.equipmentDoc.category),
    User.find({ _id: { $in: technicians.map((t) => t.user) } }).lean(),
    ContractorCompany.find({ _id: { $in: technicians.map((t) => t.contractor).filter(Boolean) } }).lean(),
  ]);
  const userBy = new Map(users.map((u) => [u._id, u]));
  const contractorBy = new Map(contractors.map((c) => [c._id, c]));

  const results = technicians.map((technician) => {
    const user = userBy.get(technician.user);
    return {
      technician,
      user,
      contractor: contractorBy.get(technician.contractor) ?? null,
      ...scoreTechnician(technician, hydrated, contextOf(technician)),
    };
  });
  results.sort((a, b) => b.score - a.score);
  return results;
}
