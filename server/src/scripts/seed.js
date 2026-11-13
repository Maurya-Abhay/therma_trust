import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { connect, disconnect } from "../db.js";
import { dec } from "../lib/decimal.js";
import { hashPassword } from "../lib/security.js";
import {
  Assessment, AssessmentAttempt, AssessmentQuestion, AuditLog, CapabilitySkill, ContractorCompany, ContractorDocument, Credential,
  Equipment, Facility, JobAssignment, JobFeedback, JobRequest, Notification, RefrigerantCylinder, RefrigerantType,
  ServiceReport, TechnicianProfile, User, WorkHistoryEntry, CylinderTransaction, CI,
} from "../models/index.js";
import { classify } from "../services/risk.js";
import { recordAudit } from "../services/audit.js";

const PASSWORD = "demopass123";
const DAY = 86_400_000;

const REFRIGERANTS = [
  { code: "R-32", name: "R-32", gwp: 675, is_a2l: true },
  { code: "R-410A", name: "R-410A", gwp: 2088 },
  { code: "R-134a", name: "R-134a", gwp: 1430 },
  { code: "R-404A", name: "R-404A", gwp: 3922 },
  { code: "R-744", name: "CO2 (R-744)", gwp: 1, is_high_pressure: true },
  { code: "R-717", name: "Ammonia (R-717)", gwp: 0, is_ammonia: true },
  { code: "R-454B", name: "R-454B", gwp: 466, is_a2l: true },
];

const q = (prompt, choices, correct_index) => ({ prompt, choices, correct_index });
const ASSESSMENTS = [
  {
    title: "Ammonia Safety Fundamentals", capability_type: "safety", safety_domain: "ammonia_safety", pass_score_percent: 75,
    questions: [
      q("Ammonia (R-717) is primarily a hazard to technicians because it is:",
        ["Flammable only above 60°C", "Toxic and corrosive at low concentrations", "Radioactive", "Odorless, making leaks hard to detect"], 1),
      q("Before opening an ammonia system for service, a technician should first:",
        ["Increase system pressure to purge air", "Isolate and pump down the section, confirming zero pressure",
          "Disable the alarm system to avoid false triggers", "Vent the section directly into the room"], 1),
      q("Which PPE is minimally required for ammonia system service?",
        ["Standard cotton gloves only", "Chemical splash goggles and an ammonia-rated respirator", "Sunglasses and ear protection",
          "No special PPE if the system is small"], 1),
      q("An ammonia leak alarm activates near the plant room. The correct first action is:",
        ["Continue working, alarms are frequently false", "Evacuate to a safe distance and follow the site's ammonia emergency plan",
          "Open all doors and windows manually before leaving", "Attempt to locate the leak source without PPE"], 1),
    ],
  },
  {
    title: "CO2 High-Pressure Operation", capability_type: "safety", safety_domain: "co2_high_pressure", pass_score_percent: 75,
    questions: [
      q("Transcritical CO2 (R-744) systems typically operate at pressures that are:",
        ["Lower than standard HFC systems", "Similar to standard HFC systems", "Substantially higher than standard HFC systems",
          "Always below atmospheric pressure"], 2),
      q("Gauges and recovery equipment used on a CO2 system must be:",
        ["The same as used for any HFC refrigerant", "Rated for CO2's higher working pressure", "Rated for vacuum service only",
          "Not required, standard tools are sufficient"], 1),
      q("A CO2 system's high-side pressure spikes well above normal on a hot day. This is:",
        ["A sign of a refrigerant leak only", "Expected transcritical behavior that still needs monitoring against system limits",
          "Irrelevant to technician safety", "Only a concern for ammonia systems"], 1),
    ],
  },
  {
    title: "A2L Refrigerant Handling", capability_type: "safety", safety_domain: "a2l_safety", pass_score_percent: 75,
    questions: [
      q("A2L refrigerants (e.g. R-32, R-454B) are classified as:",
        ["Non-flammable, low toxicity", "Mildly flammable, low toxicity", "Highly flammable, high toxicity", "Non-flammable, high toxicity"], 1),
      q("When brazing near an A2L system, a technician should:",
        ["Ignore refrigerant charge, brazing heat is unrelated",
          "Recover refrigerant and ensure the area is free of ignition sources per the system's charge limits",
          "Only worry about ignition sources for ammonia systems", "Vent the refrigerant into the room before brazing"], 1),
      q("Compared to standard HFCs, A2L refrigerant leak detection equipment should be:",
        ["Identical, no special consideration needed", "Rated/calibrated for flammable refrigerant detection",
          "Unnecessary since A2Ls have a strong odor", "Only required outdoors"], 1),
    ],
  },
];

const TECHNICIANS = [
  {
    email: "tech.senior@demo.local", first_name: "Arjun", last_name: "Senior", years: 9,
    capabilities: [
      ["equipment", "commercial_chiller", "work_history", "verified"],
      ["refrigerant", "R-32", "credential", "verified"],
      ["safety", "a2l_safety", "practical_assessment", "verified"],
      ["equipment", "co2_refrigeration", "practical_assessment", "verified"],
      ["safety", "co2_high_pressure", "practical_assessment", "verified"],
      ["safety", "refrigerant_recovery", "employer_confirmation", "verified"],
      ["safety", "electrical_diagnostics", "practical_assessment", "pending"],
    ],
    credentials: [["EPA Section 608 Universal", "platform_verified", 700]],
  },
  {
    email: "tech.mid@demo.local", first_name: "Priya", last_name: "Midlevel", years: 4,
    capabilities: [
      ["equipment", "supermarket_refrigeration", "work_history", "verified"],
      ["refrigerant", "R-404A", "work_history", "verified"],
      ["safety", "leak_detection", "employer_confirmation", "verified"],
      ["equipment", "ammonia_system", "none", "not_qualified"],
      ["safety", "ammonia_safety", "none", "not_qualified"],
    ],
    credentials: [["EPA Section 608 Type II", "platform_verified", 365]],
  },
  {
    email: "tech.junior@demo.local", first_name: "Sameer", last_name: "Junior", years: 1,
    capabilities: [
      ["equipment", "cold_storage_unit", "work_history", "pending"],
      ["refrigerant", "R-134a", "none", "pending"],
    ],
    credentials: [["EPA Section 608 Type I", "pending", null]],
  },
];

const EQUIPMENT = [
  { name: "Cold Room Chiller A", category: "commercial_chiller", refrigerant: "R-134a", capacity: "50 TR", charge: 45, criticality: "high" },
  { name: "Frozen Storage Unit 1", category: "cold_storage_unit", refrigerant: "R-404A", capacity: "30 TR", charge: 35, criticality: "critical" },
  { name: "Supermarket Rack B", category: "supermarket_refrigeration", refrigerant: "R-32", capacity: "15 TR", charge: 18, criticality: "medium" },
  { name: "Ammonia Plant Room", category: "ammonia_system", refrigerant: "R-717", capacity: "100 TR", charge: 250, criticality: "critical" },
  { name: "CO2 Booster System", category: "co2_refrigeration", refrigerant: "R-744", capacity: "40 TR", charge: 60, criticality: "high" },
];

const dateString = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** `daysAhead` days from now at `hour`:00 local time, so the demo calendar always has upcoming work. */
function at(daysAhead, hour) {
  const moment = new Date(Date.now() + daysAhead * DAY);
  moment.setHours(hour, 0, 0, 0);
  return moment;
}

/** Find a document matching `match`, or create it with `match + extra`. Returns [doc, created]. */
async function getOrCreate(Model, match, extra = {}) {
  const existing = await Model.findOne(match);
  if (existing) return [existing, false];
  return [await Model.create({ ...match, ...extra }), true];
}

async function getOrCreateUser(email, defaults) {
  const existing = await User.findOne({ email }).collation(CI);
  if (existing) return existing;
  return User.create({ email, username: email, password: await hashPassword(PASSWORD), ...defaults });
}

export async function seedDemoData({ log = console.log } = {}) {
  // reference data
  const refrigerants = {};
  for (const data of REFRIGERANTS) {
    refrigerants[data.code] = await RefrigerantType.findOneAndUpdate({ code: data.code }, data, { new: true }).lean()
      ?? (await RefrigerantType.create(data)).toObject();
  }

  const manager = await getOrCreateUser("fm@demo.local", { first_name: "Fatima", last_name: "Manager", role: "facility_manager" });
  const admin = await getOrCreateUser("admin@demo.local", {
    first_name: "Site", last_name: "Admin", role: "admin", is_staff: true, is_superuser: true,
  });

  // facility and equipment
  const [facility] = await getOrCreate(
    Facility, { owner: manager._id, name: "Coldline Distribution Center" },
    {
      segment: "cold_storage", address: "42 Industrial Ave, Mumbai", service_area: "Mumbai",
      contact_name: "Fatima Manager", contact_phone: "+91-9800000001",
    }
  );
  const equipment = [];
  for (const spec of EQUIPMENT) {
    const [unit] = await getOrCreate(
      Equipment, { facility: facility._id, name: spec.name },
      {
        category: spec.category, refrigerant_type: refrigerants[spec.refrigerant]._id, capacity: spec.capacity,
        refrigerant_charge_kg: dec(spec.charge), criticality: spec.criticality, install_date: dateString(-800),
      }
    );
    equipment.push(unit.toObject());
  }

  // contractor
  const contractorManager = await getOrCreateUser("contractor@demo.local", {
    first_name: "Rahul", last_name: "Contractor", role: "contractor_manager",
  });
  const [company] = await getOrCreate(
    ContractorCompany, { manager: contractorManager._id, name: "CoolTech Services Pvt Ltd" },
    { registration_number: "CTS-2019-4821", service_area: "Mumbai", response_time_commitment: "4 hours", verification_status: "verified" }
  );
  await getOrCreate(ContractorDocument, { company: company._id, doc_type: "insurance" }, {
    file: "contractor_documents/demo-insurance.pdf", status: "verified",
  });

  // technicians
  const profiles = [];
  for (const spec of TECHNICIANS) {
    const user = await getOrCreateUser(spec.email, { first_name: spec.first_name, last_name: spec.last_name, role: "technician" });
    const [profile, created] = await getOrCreate(
      TechnicianProfile, { user: user._id },
      {
        contractor: company._id, service_area: "Mumbai", years_experience: spec.years, available: true,
        public_token: crypto.randomUUID(),
      }
    );
    if (!created && profile.contractor === null) {
      profile.contractor = company._id;
      profile.years_experience = spec.years;
      await profile.save();
    }

    for (const [type, key, evidence, status] of spec.capabilities) {
      const target = {
        equipment_category: type === "equipment" ? key : "",
        refrigerant_type: type === "refrigerant" ? refrigerants[key]._id : null,
        safety_domain: type === "safety" ? key : "",
      };
      await getOrCreate(
        CapabilitySkill, { technician: profile._id, capability_type: type, ...target },
        {
          evidence_type: evidence, status,
          ...(status === "verified" ? { verified_by: admin._id, verified_at: new Date() } : {}),
        }
      );
    }

    for (const [name, status, expiryDays] of spec.credentials) {
      await getOrCreate(
        Credential, { technician: profile._id, name },
        {
          issuer_name: "EPA / National Certifying Body",
          credential_number: `CRED-${user._id}-${name.slice(0, 4).toUpperCase()}`,
          issue_date: dateString(-365),
          expiry_date: expiryDays ? dateString(expiryDays) : null,
          file: "credentials/demo-credential.pdf",
          status,
          reviewed_by: status !== "pending" ? admin._id : null,
          reviewed_at: status !== "pending" ? new Date() : null,
        }
      );
    }

    const firstEquipment = spec.capabilities[0][0] === "equipment" ? spec.capabilities[0][1] : "commercial_chiller";
    await getOrCreate(
      WorkHistoryEntry, { technician: profile._id, equipment_category: firstEquipment, date: dateString(-90) },
      { description: "Routine maintenance and diagnostics.", refrigerant_type: refrigerants["R-134a"]._id }
    );
    profiles.push({ profile, user });
  }

  // jobs
  const jobSpecs = [
    { category: "ammonia_system", urgency: "urgent", days: 1, hour: 9, description: "Ammonia plant room showing high discharge pressure alarm, needs diagnostics." },
    { category: "commercial_chiller", urgency: "scheduled", days: 4, hour: 14, description: "Scheduled preventive maintenance for cold room chiller." },
  ];
  const jobs = [];
  for (const spec of jobSpecs) {
    const unit = equipment.find((e) => e.category === spec.category);
    const refrigerant = Object.values(refrigerants).find((r) => r._id === unit.refrigerant_type);
    const { riskLevel, requiredCapabilities } = classify(unit, refrigerant, spec.urgency);
    const [job] = await getOrCreate(
      JobRequest, { facility: facility._id, equipment: unit._id, created_by: manager._id, description: spec.description },
      { urgency: spec.urgency, risk_level: riskLevel, required_capabilities: requiredCapabilities, scheduled_for: at(spec.days, spec.hour) }
    );
    if (!job.scheduled_for) {
      job.scheduled_for = at(spec.days, spec.hour);
      await job.save();
    }
    jobs.push(job);
  }

  // Assignments, a completed report, and feedback make the technician and
  // facility portals useful immediately after seeding.
  const senior = profiles[0];
  const midlevel = profiles[1];
  const firstAssignment = await getOrCreate(JobAssignment, { job: jobs[0]._id }, {
    technician: senior.profile._id, assigned_by: manager._id,
  });
  const secondAssignment = await getOrCreate(JobAssignment, { job: jobs[1]._id }, {
    technician: midlevel.profile._id, assigned_by: manager._id,
  });
  const [report] = await getOrCreate(ServiceReport, { job: jobs[1]._id }, {
    technician: secondAssignment[0].technician,
    fault_description: "Routine preventive maintenance completed.",
    diagnostic_readings: { suction_pressure: "42 psi", superheat: "8 K" },
    refrigerant_type: jobs[1].equipment ? equipment.find((unit) => unit._id === jobs[1].equipment).refrigerant_type : refrigerants["R-134a"]._id,
    summary: "System inspected, filters cleaned and operating pressures verified.",
    status: "approved",
    technician_signed_at: new Date(),
    facility_approved_by: manager._id,
    facility_approved_at: new Date(),
  });
  await JobRequest.updateOne({ _id: jobs[0]._id }, { status: "assigned" });
  await JobRequest.updateOne({ _id: jobs[1]._id }, { status: "completed" });
  await getOrCreate(JobFeedback, { job: jobs[1]._id }, {
    rating: 5, comment: "Clear report and timely maintenance.", created_by: manager._id,
  });
  await getOrCreate(Notification, { user: senior.user._id, title: "New job assigned" }, {
    kind: "job", body: "An ammonia plant diagnostic job is ready for review.", link: `/my-jobs/${jobs[0]._id}/report`,
  });
  await getOrCreate(Notification, { user: midlevel.user._id, title: "Report approved" }, {
    kind: "report", body: "Your preventive maintenance report was approved.", link: `/my-jobs/${jobs[1]._id}/report`,
  });
  const assessment = await Assessment.findOne({ title: "A2L Refrigerant Handling" }).lean();
  if (assessment) {
    const questions = await AssessmentQuestion.find({ assessment: assessment._id }).sort({ order: 1, _id: 1 }).lean();
    await getOrCreate(AssessmentAttempt, { assessment: assessment._id, technician: senior.profile._id }, {
      answers: questions.map((question) => question.correct_index), score_percent: 100, passed: true,
    });
  }
  if (!(await AuditLog.exists({ action: "demo.seed", object_type: "Seed", object_id: "demo-v1" }))) {
    await recordAudit(admin, "demo.seed", "Seed", "demo-v1", {
      users: profiles.length + 3, jobs: jobs.length, reports: await ServiceReport.countDocuments(),
    });
  }

  // assessments
  for (const spec of ASSESSMENTS) {
    const [assessment] = await getOrCreate(Assessment, { title: spec.title }, {
      capability_type: spec.capability_type, safety_domain: spec.safety_domain ?? "", equipment_category: spec.equipment_category ?? "",
      pass_score_percent: spec.pass_score_percent,
    });
    for (const [order, question] of spec.questions.entries()) {
      await getOrCreate(AssessmentQuestion, { assessment: assessment._id, prompt: question.prompt }, {
        choices: question.choices, correct_index: question.correct_index, order,
      });
    }
  }

  // cylinders (one nearly empty so the low-cylinder alert shows)
  const cylinders = [
    ["CT-134A-01", "R-134a", "supply", 13.6, 12],
    ["CT-134A-REC", "R-134a", "recovery", 20, 2],
    ["CT-404A-01", "R-404A", "supply", 10, 0.8],
  ];
  for (const [serial, code, kind, capacity, current] of cylinders) {
    const [cylinder, created] = await getOrCreate(RefrigerantCylinder, { company: company._id, serial_number: serial }, {
      refrigerant_type: refrigerants[code]._id, kind, capacity_kg: dec(capacity), current_kg: dec(current),
    });
    if (created) {
      await CylinderTransaction.create({
        cylinder: cylinder._id, kind: "initial_fill", amount_kg: cylinder.current_kg, balance_after_kg: cylinder.current_kg,
      });
    }
  }

  log("Demo data seeded.");
  log(`Login credentials (password '${PASSWORD}' for all):`);
  log(`  Facility manager: ${manager.email}`);
  log(`  Contractor manager: ${contractorManager.email}`);
  for (const { user } of profiles) log(`  Technician: ${user.email}`);
  log(`  Admin: ${admin.email}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI explicitly: the seed writes demo data and will not guess a database.");
    process.exit(1);
  }
  await connect();
  const mongoose = (await import("mongoose")).default;
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  await seedDemoData();
  await disconnect();
}
