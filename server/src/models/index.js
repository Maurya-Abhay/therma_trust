import mongoose from "mongoose";
import { defineModel } from "../lib/ids.js";
import * as C from "../lib/choices.js";

const { Mixed } = mongoose.Schema.Types;
const { Decimal128 } = mongoose.Types;
const zeroKg = () => Decimal128.fromString("0.00");
const now = () => new Date();

/** Case-insensitive collation: email addresses are matched without regard to capitals. */
export const CI = { locale: "en", strength: 2 };

// ---- accounts -------------------------------------------------------------------

export const User = defineModel(
  "User",
  {
    email: { type: String, required: true, trim: true },
    username: { type: String, default: "" },
    password: { type: String, default: "" },
    first_name: { type: String, default: "" },
    last_name: { type: String, default: "" },
    phone: { type: String, default: "" },
    role: { type: String, enum: C.Role.values, required: true },
    is_staff: { type: Boolean, default: false },
    is_superuser: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    date_joined: { type: Date, default: now },
    last_login: { type: Date, default: null },
  },
  {
    collection: "users",
    indexes: [[{ email: 1 }, { unique: true, collation: CI }]],
    configure(schema) {
      schema.methods.fullName = function fullName() {
        return `${this.first_name} ${this.last_name}`.trim();
      };
    },
  }
);

export const isAdmin = (user) => user.role === "admin" || user.is_staff === true;
export const fullNameOf = (user) => `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

// ---- core -----------------------------------------------------------------------

export const RefrigerantType = defineModel(
  "RefrigerantType",
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    gwp: { type: Number, required: true },
    is_a2l: { type: Boolean, default: false },
    is_ammonia: { type: Boolean, default: false },
    is_high_pressure: { type: Boolean, default: false },
  },
  { collection: "refrigerant_types", indexes: [[{ code: 1 }, { unique: true }]] }
);

export const AuditLog = defineModel(
  "AuditLog",
  {
    actor: { type: Number, default: null },
    action: { type: String, required: true },
    object_type: { type: String, required: true },
    object_id: { type: String, required: true },
    metadata: { type: Mixed, default: () => ({}) },
    created_at: { type: Date, default: now },
    // The exact timestamp text the entry hash was computed over (microsecond precision for carried-over rows).
    created_at_iso: { type: String, default: "" },
    prev_hash: { type: String, default: "" },
    entry_hash: { type: String, default: "" },
  },
  {
    collection: "audit_logs",
    // Two writers racing for the same predecessor collide here and one retries, so the chain stays linear.
    indexes: [[{ prev_hash: 1 }, { unique: true }], [{ created_at: -1 }]],
  }
);

export const Notification = defineModel(
  "Notification",
  {
    user: { type: Number, required: true },
    kind: { type: String, enum: C.NotificationKind.values, default: "info" },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    read_at: { type: Date, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "notifications", indexes: [[{ user: 1, read_at: 1 }], [{ user: 1, created_at: -1 }]] }
);

export const PushSubscription = defineModel(
  "PushSubscription",
  {
    user: { type: Number, required: true },
    endpoint: { type: String, required: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    user_agent: { type: String, default: "" },
    created_at: { type: Date, default: now },
  },
  { collection: "push_subscriptions", indexes: [[{ endpoint: 1 }, { unique: true }], [{ user: 1 }]] }
);

// ---- facilities -----------------------------------------------------------------

export const Facility = defineModel(
  "Facility",
  {
    owner: { type: Number, required: true },
    name: { type: String, required: true },
    segment: { type: String, enum: C.FacilitySegment.values, default: "cold_storage" },
    address: { type: String, required: true },
    service_area: { type: String, required: true },
    contact_name: { type: String, default: "" },
    contact_phone: { type: String, default: "" },
    created_at: { type: Date, default: now },
  },
  { collection: "facilities", indexes: [[{ owner: 1, created_at: -1 }]] }
);

export const Equipment = defineModel(
  "Equipment",
  {
    facility: { type: Number, required: true },
    name: { type: String, required: true },
    category: { type: String, enum: C.EquipmentCategory.values, required: true },
    refrigerant_type: { type: Number, required: true },
    capacity: { type: String, default: "" },
    refrigerant_charge_kg: { type: Decimal128, default: null },
    criticality: { type: String, enum: C.Criticality.values, default: "medium" },
    install_date: { type: String, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "equipment", indexes: [[{ facility: 1 }]] }
);

// ---- contractors ----------------------------------------------------------------

export const ContractorCompany = defineModel(
  "ContractorCompany",
  {
    manager: { type: Number, required: true },
    name: { type: String, required: true },
    registration_number: { type: String, default: "" },
    service_area: { type: String, required: true },
    response_time_commitment: { type: String, default: "" },
    verification_status: { type: String, enum: C.ContractorVerificationStatus.values, default: "pending" },
    created_at: { type: Date, default: now },
  },
  { collection: "contractor_companies", indexes: [[{ manager: 1 }]] }
);

export const ContractorDocument = defineModel(
  "ContractorDocument",
  {
    company: { type: Number, required: true },
    doc_type: { type: String, enum: C.ContractorDocType.values, required: true },
    file: { type: String, required: true },
    status: { type: String, enum: C.ContractorDocStatus.values, default: "pending" },
    uploaded_at: { type: Date, default: now },
  },
  { collection: "contractor_documents", indexes: [[{ company: 1 }]] }
);

// ---- technicians ----------------------------------------------------------------

export const TechnicianProfile = defineModel(
  "TechnicianProfile",
  {
    user: { type: Number, required: true },
    contractor: { type: Number, default: null },
    service_area: { type: String, default: "" },
    years_experience: { type: Number, default: 0 },
    available: { type: Boolean, default: true },
    bio: { type: String, default: "" },
    public_token: { type: String, required: true },
  },
  {
    collection: "technician_profiles",
    indexes: [[{ user: 1 }, { unique: true }], [{ public_token: 1 }, { unique: true }], [{ contractor: 1 }]],
  }
);

export const Credential = defineModel(
  "Credential",
  {
    technician: { type: Number, required: true },
    name: { type: String, required: true },
    issuer_name: { type: String, required: true },
    credential_number: { type: String, default: "" },
    issue_date: { type: String, default: null },
    expiry_date: { type: String, default: null },
    file: { type: String, required: true },
    status: { type: String, enum: C.CredentialStatus.values, default: "pending" },
    reviewed_by: { type: Number, default: null },
    reviewed_at: { type: Date, default: null },
    notes: { type: String, default: "" },
    ai_check: { type: Mixed, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "credentials", indexes: [[{ technician: 1 }], [{ status: 1 }]] }
);

export const CapabilitySkill = defineModel(
  "CapabilitySkill",
  {
    technician: { type: Number, required: true },
    capability_type: { type: String, enum: C.CapabilityType.values, required: true },
    equipment_category: { type: String, default: "" },
    refrigerant_type: { type: Number, default: null },
    safety_domain: { type: String, default: "" },
    evidence_type: { type: String, enum: C.EvidenceType.values, default: "none" },
    status: { type: String, enum: C.CapabilityStatus.values, default: "pending" },
    note: { type: String, default: "" },
    verified_by: { type: Number, default: null },
    verified_at: { type: Date, default: null },
  },
  {
    collection: "capability_skills",
    indexes: [
      [
        { technician: 1, capability_type: 1, equipment_category: 1, refrigerant_type: 1, safety_domain: 1 },
        { unique: true },
      ],
      [{ status: 1 }],
    ],
  }
);

export const WorkHistoryEntry = defineModel(
  "WorkHistoryEntry",
  {
    technician: { type: Number, required: true },
    equipment_category: { type: String, enum: C.EquipmentCategory.values, required: true },
    refrigerant_type: { type: Number, default: null },
    job: { type: Number, default: null },
    description: { type: String, required: true },
    date: { type: String, required: true },
  },
  { collection: "work_history", indexes: [[{ technician: 1, equipment_category: 1 }]] }
);

// ---- jobs -----------------------------------------------------------------------

export const JobRequest = defineModel(
  "JobRequest",
  {
    facility: { type: Number, required: true },
    equipment: { type: Number, required: true },
    created_by: { type: Number, required: true },
    description: { type: String, required: true },
    urgency: { type: String, enum: C.Urgency.values, default: "scheduled" },
    status: { type: String, enum: C.JobStatus.values, default: "open" },
    risk_level: { type: String, default: "" },
    required_capabilities: { type: [Mixed], default: [] },
    scheduled_for: { type: Date, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "job_requests", indexes: [[{ facility: 1, created_at: -1 }], [{ equipment: 1 }], [{ scheduled_for: 1 }]] }
);

export const JobAssignment = defineModel(
  "JobAssignment",
  {
    job: { type: Number, required: true },
    technician: { type: Number, required: true },
    assigned_by: { type: Number, default: null },
    override_warning: { type: Boolean, default: false },
    override_reason: { type: String, default: "" },
    assigned_at: { type: Date, default: now },
  },
  { collection: "job_assignments", indexes: [[{ job: 1 }, { unique: true }], [{ technician: 1 }]] }
);

export const JobFeedback = defineModel(
  "JobFeedback",
  {
    job: { type: Number, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, default: "" },
    created_by: { type: Number, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "job_feedback", indexes: [[{ job: 1 }, { unique: true }]] }
);

// ---- service reports and cylinders ----------------------------------------------

export const ServiceReport = defineModel(
  "ServiceReport",
  {
    job: { type: Number, required: true },
    technician: { type: Number, required: true },
    fault_description: { type: String, required: true },
    diagnostic_readings: { type: Mixed, default: () => ({}) },
    refrigerant_type: { type: Number, required: true },
    refrigerant_added_kg: { type: Decimal128, default: zeroKg },
    refrigerant_recovered_kg: { type: Decimal128, default: zeroKg },
    added_from_cylinder: { type: Number, default: null },
    recovered_into_cylinder: { type: Number, default: null },
    leak_test_result: { type: String, default: "" },
    vacuum_result: { type: String, default: "" },
    parts_replaced: { type: String, default: "" },
    safety_checklist: { type: Mixed, default: () => ({}) },
    summary: { type: String, default: "" },
    status: { type: String, enum: C.ReportStatus.values, default: "submitted" },
    technician_signed_at: { type: Date, default: null },
    facility_approved_by: { type: Number, default: null },
    facility_approved_at: { type: Date, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "service_reports", indexes: [[{ job: 1 }, { unique: true }], [{ technician: 1 }], [{ created_at: -1 }]] }
);

export const ServiceReportPhoto = defineModel(
  "ServiceReportPhoto",
  {
    report: { type: Number, required: true },
    image: { type: String, required: true },
    caption: { type: String, default: "" },
    is_before: { type: Boolean, default: true },
  },
  { collection: "service_report_photos", indexes: [[{ report: 1 }]] }
);

export const RefrigerantCylinder = defineModel(
  "RefrigerantCylinder",
  {
    company: { type: Number, required: true },
    serial_number: { type: String, required: true },
    refrigerant_type: { type: Number, required: true },
    kind: { type: String, enum: C.CylinderKind.values, default: "supply" },
    capacity_kg: { type: Decimal128, required: true },
    current_kg: { type: Decimal128, default: zeroKg },
    created_at: { type: Date, default: now },
  },
  { collection: "refrigerant_cylinders", indexes: [[{ company: 1, serial_number: 1 }, { unique: true }]] }
);

export const CylinderTransaction = defineModel(
  "CylinderTransaction",
  {
    cylinder: { type: Number, required: true },
    kind: { type: String, enum: C.CylinderTransactionKind.values, required: true },
    amount_kg: { type: Decimal128, required: true },
    balance_after_kg: { type: Decimal128, required: true },
    service_report: { type: Number, default: null },
    created_by: { type: Number, default: null },
    created_at: { type: Date, default: now },
  },
  { collection: "cylinder_transactions", indexes: [[{ cylinder: 1, created_at: -1 }]] }
);

// ---- assessments ----------------------------------------------------------------

export const Assessment = defineModel(
  "Assessment",
  {
    title: { type: String, required: true },
    capability_type: { type: String, enum: C.CapabilityType.values, required: true },
    equipment_category: { type: String, default: "" },
    refrigerant_type: { type: Number, default: null },
    safety_domain: { type: String, default: "" },
    pass_score_percent: { type: Number, default: 80 },
    is_active: { type: Boolean, default: true },
  },
  { collection: "assessments" }
);

export const AssessmentQuestion = defineModel(
  "AssessmentQuestion",
  {
    assessment: { type: Number, required: true },
    prompt: { type: String, required: true },
    choices: { type: [String], default: [] },
    correct_index: { type: Number, required: true },
    order: { type: Number, default: 0 },
  },
  { collection: "assessment_questions", indexes: [[{ assessment: 1, order: 1 }]] }
);

export const AssessmentAttempt = defineModel(
  "AssessmentAttempt",
  {
    assessment: { type: Number, required: true },
    technician: { type: Number, required: true },
    answers: { type: [Number], default: [] },
    score_percent: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    submitted_at: { type: Date, default: now },
  },
  { collection: "assessment_attempts", indexes: [[{ technician: 1, passed: 1 }]] }
);

/** Batch-load documents by id into a Map, so a list of rows needs one query per relation, not one per row. */
export async function byId(Model, ids, select) {
  const unique = [...new Set(ids.filter((id) => id !== null && id !== undefined))];
  if (!unique.length) return new Map();
  const rows = await Model.find({ _id: { $in: unique } }, select).lean();
  return new Map(rows.map((row) => [row._id, row]));
}
