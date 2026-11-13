export type Role = "facility_manager" | "technician" | "contractor_manager" | "admin";
export type SelfRegisterRole = Exclude<Role, "admin">;

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: Role;
}

export interface Option {
  value: string;
  label: string;
}

export interface Choices {
  equipment_categories: Option[];
  safety_domains: Option[];
  capability_types: Option[];
  evidence_types: Option[];
  capability_statuses: Option[];
  credential_statuses: Option[];
  criticalities: Option[];
  urgencies: Option[];
  risk_levels: Option[];
  job_statuses: Option[];
}

export interface RefrigerantType {
  id: number;
  code: string;
  name: string;
  gwp: number;
  is_a2l: boolean;
  is_ammonia: boolean;
  is_high_pressure: boolean;
}

export interface Facility {
  id: number;
  owner: number;
  name: string;
  segment: string;
  address: string;
  service_area: string;
  contact_name: string;
  contact_phone: string;
  equipment_count: number;
  created_at: string;
}

export interface DriftWarning {
  metric: string;
  values: number[];
  direction: "increasing" | "decreasing";
}

export interface Equipment {
  id: number;
  facility: number;
  name: string;
  category: string;
  category_display: string;
  refrigerant_type: number;
  refrigerant_type_code: string;
  capacity: string;
  refrigerant_charge_kg: string | null;
  criticality: string;
  install_date: string | null;
  created_at: string;
  drift_warnings: DriftWarning[];
}

export interface ContractorCompany {
  id: number;
  manager: number;
  name: string;
  registration_number: string;
  service_area: string;
  response_time_commitment: string;
  verification_status: string;
  technician_count: number;
  created_at: string;
}

export interface ContractorDocument {
  id: number;
  company: number;
  company_name: string;
  doc_type: string;
  file: string;
  status: string;
  uploaded_at: string;
}

export interface TechnicianProfile {
  id: number;
  user: number;
  email: string;
  full_name: string;
  contractor: number | null;
  contractor_name: string | null;
  service_area: string;
  years_experience: number;
  available: boolean;
  bio: string;
  public_token: string;
  average_rating: number | null;
  rating_count: number;
}

export interface ExtractedCredentialFields {
  is_credential_document: boolean;
  holder_name: string | null;
  credential_name: string | null;
  issuer_name: string | null;
  credential_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  flags?: AiCheckFlag[];
}

export interface AiCheckFlag {
  code: string;
  severity: "warning" | "info";
  message: string;
}

export interface AiCheck {
  checked_at: string;
  model: string;
  extracted: ExtractedCredentialFields;
  flags: AiCheckFlag[];
}

export interface Credential {
  id: number;
  technician: number;
  technician_name: string;
  name: string;
  issuer_name: string;
  credential_number: string;
  issue_date: string | null;
  expiry_date: string | null;
  file: string;
  status: string;
  effective_status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  notes: string;
  ai_check?: AiCheck | null;
  created_at: string;
}

export interface CapabilitySkill {
  id: number;
  technician: number;
  technician_name: string;
  capability_type: "equipment" | "refrigerant" | "safety";
  equipment_category: string;
  refrigerant_type: number | null;
  refrigerant_type_code: string | null;
  safety_domain: string;
  evidence_type: string;
  status: "verified" | "pending" | "not_qualified";
  note: string;
  label: string;
  verified_by: number | null;
  verified_at: string | null;
}

export interface WorkHistoryEntry {
  id: number;
  technician: number;
  equipment_category: string;
  refrigerant_type: number | null;
  job: number | null;
  description: string;
  date: string;
}

export interface RequiredCapability {
  capability_type: string;
  key: string | number;
  reason?: string;
}

export interface JobAssignment {
  id: number;
  job: number;
  technician: number;
  technician_name: string;
  assigned_by: number;
  override_warning: boolean;
  override_reason: string;
  assigned_at: string;
}

export interface JobRequest {
  id: number;
  facility: number;
  facility_name: string;
  equipment: number;
  equipment_name: string;
  created_by: number;
  description: string;
  urgency: string;
  status: string;
  risk_level: string;
  required_capabilities: RequiredCapability[];
  assignment: JobAssignment | null;
  created_at: string;
  equipment_drift_warnings: DriftWarning[];
  scheduled_for: string | null;
  feedback: JobFeedback | null;
}

export interface JobFeedback {
  id: number;
  job: number;
  rating: number;
  comment: string;
  created_at: string;
}

export interface AppNotification {
  id: number;
  kind: "job" | "credential" | "report" | "feedback" | "info";
  title: string;
  body: string;
  link: string;
  read: boolean;
  created_at: string;
}

export interface PushKeyResponse {
  enabled: boolean;
  public_key: string;
}

export interface NotificationsResponse {
  unread_count: number;
  results: AppNotification[];
}

export interface SearchResult {
  type: "facility" | "equipment" | "job" | "technician" | "cylinder" | "credential";
  id: number;
  title: string;
  subtitle: string;
  link: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  done: boolean;
  link: string;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  completed: number;
  total: number;
}

export interface MonthlyRefrigerant {
  month: string;
  added_kg: number;
  recovered_kg: number;
}

export interface EquipmentHistory {
  equipment: Equipment;
  facility_name: string;
  leak_rate: LeakRateEquipmentRow;
  jobs: {
    id: number;
    status: string;
    risk_level: string;
    urgency: string;
    description: string;
    created_at: string;
    scheduled_for: string | null;
  }[];
  reports: {
    id: number;
    job: number;
    created_at: string;
    status: string;
    refrigerant_added_kg: number;
    refrigerant_recovered_kg: number;
    summary: string;
    technician: string;
  }[];
}

export interface JobMatch {
  technician_id: number;
  name: string;
  contractor: string | null;
  score: number;
  breakdown: Record<string, number>;
  missing_requirements: RequiredCapability[];
  is_qualified: boolean;
}

export interface ServiceReportPhoto {
  id: number;
  report: number;
  image: string;
  caption: string;
  is_before: boolean;
}

export interface ServiceReport {
  id: number;
  job: number;
  technician: number;
  technician_name: string;
  fault_description: string;
  diagnostic_readings: Record<string, string | number>;
  refrigerant_type: number;
  refrigerant_code: string;
  refrigerant_added_kg: string;
  refrigerant_recovered_kg: string;
  added_from_cylinder: number | null;
  added_from_cylinder_serial: string | null;
  recovered_into_cylinder: number | null;
  recovered_into_cylinder_serial: string | null;
  leak_test_result: string;
  vacuum_result: string;
  parts_replaced: string;
  safety_checklist: Record<string, boolean>;
  summary: string;
  status: string;
  technician_signed_at: string | null;
  facility_approved_by: number | null;
  facility_approved_at: string | null;
  photos: ServiceReportPhoto[];
  created_at: string;
}

export interface LeakRateEquipmentRow {
  equipment_id: number;
  equipment_name: string;
  facility_name: string;
  charge_kg: number | null;
  added_kg_12mo: number;
  leak_rate_percent: number | null;
  threshold_percent: number;
  exceeds_threshold: boolean;
  note: string | null;
}

export interface RefrigerantDashboardSummary {
  is_estimate: boolean;
  note: string;
  total_added_kg: number;
  total_recovered_kg: number;
  leaked_estimate_kg: number;
  co2e_estimate_kg: number;
  by_refrigerant: Record<string, { added_kg: number; recovered_kg: number; leaked_estimate_kg: number }>;
  report_count: number;
  monthly: MonthlyRefrigerant[];
  leak_rate_by_equipment: LeakRateEquipmentRow[];
}

export interface AssessmentQuestion {
  id: number;
  prompt: string;
  choices: string[];
  order: number;
}

export interface Assessment {
  id: number;
  title: string;
  capability_type: "equipment" | "refrigerant" | "safety";
  equipment_category: string;
  refrigerant_type: number | null;
  refrigerant_type_code: string | null;
  safety_domain: string;
  target_label: string;
  pass_score_percent: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentAttemptResult {
  id: number;
  assessment: number;
  assessment_title: string;
  technician: number;
  score_percent: number;
  passed: boolean;
  submitted_at: string;
  capability_status: "verified" | "pending" | "not_qualified" | null;
}

export interface PublicVerifiedCapability {
  label: string;
  capability_type: string;
  verified_at: string | null;
}

export interface PublicVerifiedCredential {
  name: string;
  issuer_name: string;
  expiry_date: string | null;
}

export interface PublicTechnicianVerification {
  full_name: string;
  contractor_name: string | null;
  years_experience: number;
  verified_capabilities: PublicVerifiedCapability[];
  verified_credentials: PublicVerifiedCredential[];
}

export interface ContractorCompliance {
  score: number;
  technician_count: number;
  capability_verified_rate: number;
  credential_verified_rate: number;
  document_verified_rate: number;
  company_verified: boolean;
}

export interface AuditLogEntry {
  id: number;
  actor: string | null;
  action: string;
  object_type: string;
  object_id: string;
  created_at: string;
}

export interface AdminDashboard {
  pending_credentials: number;
  pending_capabilities: number;
  pending_contractor_documents: number;
  pending_contractor_verifications: number;
  total_technicians: number;
  total_facilities: number;
  total_jobs: number;
  recent_audit_log: AuditLogEntry[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface RefrigerantCylinder {
  id: number;
  company: number;
  company_name: string;
  serial_number: string;
  refrigerant_type: number;
  refrigerant_type_code: string;
  kind: "supply" | "recovery";
  capacity_kg: string;
  current_kg: string;
  created_at: string;
}

export interface CylinderTransaction {
  id: number;
  kind: "initial_fill" | "draw" | "recovery";
  amount_kg: string;
  balance_after_kg: string;
  service_report: number | null;
  job: number | null;
  technician_name: string | null;
  created_at: string;
}

export interface ComplianceAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  detail: string;
  link: string;
}