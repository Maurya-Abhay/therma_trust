export const ROLES = {
  TECHNICIAN: 'technician' as const,
  FACILITY_MANAGER: 'facility_manager' as const,
  CONTRACTOR_MANAGER: 'contractor_manager' as const,
  ADMIN: 'admin' as const,
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  technician: 'Technician',
  facility_manager: 'Facility Manager',
  contractor_manager: 'Contractor Manager',
  admin: 'Admin',
};

export const ROLE_ICONS: Record<Role, string> = {
  technician: 'wrench',
  facility_manager: 'building-2',
  contractor_manager: 'users',
  admin: 'shield',
};

export const ROLE_COLORS: Record<Role, string> = {
  technician: '#0F766E',
  facility_manager: '#22c55e',
  contractor_manager: '#f59e0b',
  admin: '#a855f7',
};

export const JOB_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const RISK_LEVELS = [
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'very_high', label: 'Very High', color: '#ef4444' },
  { value: 'critical', label: 'Critical', color: '#991b1b' },
] as const;

export const CREDENTIAL_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'document_verified', label: 'Document Verified' },
  { value: 'issuer_confirmed', label: 'Issuer Confirmed' },
  { value: 'platform_verified', label: 'Platform Verified' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export const CAPABILITY_STATUSES = [
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_qualified', label: 'Not Qualified' },
] as const;

export const EQUIPMENT_CATEGORIES = [
  { value: 'chiller', label: 'Chiller' },
  { value: 'ahu', label: 'AHU' },
  { value: 'vrv_vrf', label: 'VRV/VRF' },
  { value: 'split', label: 'Split System' },
  { value: 'packaged', label: 'Packaged Unit' },
  { value: 'cooling_tower', label: 'Cooling Tower' },
  { value: 'boiler', label: 'Boiler' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'refrigeration_rack', label: 'Refrigeration Rack' },
  { value: 'cold_room', label: 'Cold Room' },
  { value: 'display_case', label: 'Display Case' },
  { value: 'other', label: 'Other' },
] as const;

export const REFRIGERANT_TYPES = [
  { value: 'r22', label: 'R-22', gwp: 1810 },
  { value: 'r134a', label: 'R-134a', gwp: 1430 },
  { value: 'r404a', label: 'R-404A', gwp: 3922 },
  { value: 'r407c', label: 'R-407C', gwp: 1774 },
  { value: 'r410a', label: 'R-410A', gwp: 2088 },
  { value: 'r32', label: 'R-32', gwp: 675 },
  { value: 'r290', label: 'R-290 (Propane)', gwp: 3 },
  { value: 'r600a', label: 'R-600a (Isobutane)', gwp: 3 },
  { value: 'r717', label: 'R-717 (Ammonia)', gwp: 0 },
  { value: 'r744', label: 'R-744 (CO2)', gwp: 1 },
  { value: 'r448a', label: 'R-448A', gwp: 1387 },
  { value: 'r449a', label: 'R-449A', gwp: 1397 },
  { value: 'r452a', label: 'R-452A', gwp: 2141 },
  { value: 'r454b', label: 'R-454B', gwp: 466 },
  { value: 'r454c', label: 'R-454C', gwp: 148 },
  { value: 'r513a', label: 'R-513A', gwp: 631 },
  { value: 'r1234ze', label: 'R-1234ze', gwp: 7 },
  { value: 'r1234yf', label: 'R-1234yf', gwp: 4 },
] as const;

export const CYLINDER_KINDS = [
  { value: 'supply', label: 'Supply' },
  { value: 'recovery', label: 'Recovery' },
] as const;

export const EVIDENCE_TYPES = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'practical_assessment', label: 'Practical Assessment' },
  { value: 'work_experience', label: 'Work Experience' },
  { value: 'training_record', label: 'Training Record' },
  { value: 'manufacturer_training', label: 'Manufacturer Training' },
] as const;

export const CRITICALITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export const URGENCIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
] as const;

export const SERVICE_REPORT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export const CONTRACTOR_VERIFICATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export const DOCUMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export const NOTIFICATION_KINDS = [
  { value: 'job', label: 'Job' },
  { value: 'credential', label: 'Credential' },
  { value: 'report', label: 'Report' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'info', label: 'Info' },
] as const;