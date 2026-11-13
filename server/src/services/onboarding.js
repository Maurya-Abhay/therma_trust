import {
  AssessmentAttempt, CapabilitySkill, ContractorCompany, ContractorDocument, Credential, Equipment, Facility,
  JobAssignment, JobRequest, RefrigerantCylinder, TechnicianProfile,
} from "../models/index.js";

/**
 * A short, derived "get started" checklist per role.
 *
 * Nothing is stored: each step is true or false from data that already exists,
 * so it can never drift from what the user has really done.
 */
const step = (id, title, done, link) => ({ id, title, done: Boolean(done), link });
const exists = async (Model, filter) => (await Model.exists(filter)) !== null;

async function technician(user) {
  const profile = await TechnicianProfile.findOne({ user: user._id }).lean();
  if (!profile) return [];
  const completedJob = async () => {
    const assignments = await JobAssignment.find({ technician: profile._id }, { job: 1 }).lean();
    if (!assignments.length) return false;
    return exists(JobRequest, { _id: { $in: assignments.map((a) => a.job) }, status: "completed" });
  };
  return [
    step("profile", "Complete your profile", profile.service_area && profile.years_experience > 0, "/profile?add=1"),
    step("credential", "Upload a credential", await exists(Credential, { technician: profile._id }), "/credentials?add=1"),
    step("capability", "Declare a capability", await exists(CapabilitySkill, { technician: profile._id }), "/capabilities?add=1"),
    step("assessment", "Pass a practical assessment", await exists(AssessmentAttempt, { technician: profile._id, passed: true }), "/assessments"),
    step("job", "Finish your first job", await completedJob(), "/my-jobs"),
  ];
}

async function facilityManager(user) {
  const facilities = await Facility.find({ owner: user._id }, { _id: 1 }).lean();
  const ids = facilities.map((f) => f._id);
  // Equipment has its own section; before there is a facility there is nothing to attach it to.
  const equipmentLink = ids.length ? "/equipment?add=1" : "/facilities?add=1";
  return [
    step("facility", "Add a facility", ids.length > 0, "/facilities?add=1"),
    step("equipment", "Register equipment", ids.length > 0 && (await exists(Equipment, { facility: { $in: ids } })), equipmentLink),
    step("job", "Raise a job request", ids.length > 0 && (await exists(JobRequest, { facility: { $in: ids } })), "/jobs/new"),
    step("complete", "Complete a job", ids.length > 0 && (await exists(JobRequest, { facility: { $in: ids }, status: "completed" })), "/jobs"),
  ];
}

async function contractor(user) {
  const company = await ContractorCompany.findOne({ manager: user._id }).sort({ _id: 1 }).lean();
  const has = async (Model, field) => Boolean(company) && (await exists(Model, { [field]: company._id }));
  return [
    step("company", "Register your company", company, "/company"),
    step("document", "Upload a business document", await has(ContractorDocument, "company"), "/company?add=1"),
    step("roster", "Bring a technician onto the roster", await has(TechnicianProfile, "contractor"), "/roster?add=1"),
    step("cylinder", "Register a cylinder", await has(RefrigerantCylinder, "company"), "/cylinders?add=1"),
  ];
}

export async function buildChecklist(user) {
  let steps = [];
  if (user.role === "technician") steps = await technician(user);
  else if (user.role === "facility_manager") steps = await facilityManager(user);
  else if (user.role === "contractor_manager") steps = await contractor(user);
  return { steps, completed: steps.filter((s) => s.done).length, total: steps.length };
}
