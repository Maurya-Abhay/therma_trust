/** Enumerations shared by models, validation and the /choices endpoint. Each is [value, label][]. */
const define = (pairs) => {
  const list = pairs.map(([value, label]) => ({ value, label }));
  return {
    options: list,
    values: list.map((item) => item.value),
    label: (value) => list.find((item) => item.value === value)?.label ?? value ?? "",
  };
};

export const Role = define([
  ["facility_manager", "Facility Manager"],
  ["technician", "Technician"],
  ["contractor_manager", "Contractor Manager"],
  ["admin", "Admin"],
]);

export const EquipmentCategory = define([
  ["commercial_chiller", "Commercial Chiller"],
  ["cold_storage_unit", "Cold Storage Unit"],
  ["supermarket_refrigeration", "Supermarket Refrigeration"],
  ["vrf_system", "VRF System"],
  ["data_center_cooling", "Data Center Cooling"],
  ["ammonia_system", "Ammonia System"],
  ["co2_refrigeration", "CO2 Refrigeration"],
]);

export const SafetyDomain = define([
  ["a2l_safety", "A2L Refrigerant Safety"],
  ["ammonia_safety", "Ammonia Safety"],
  ["co2_high_pressure", "CO2 High-Pressure Operation"],
  ["electrical_diagnostics", "Electrical Diagnostics"],
  ["refrigerant_recovery", "Refrigerant Recovery"],
  ["vacuum_evacuation", "Vacuum Evacuation"],
  ["leak_detection", "Leak Detection"],
]);

export const CapabilityType = define([
  ["equipment", "Equipment"],
  ["refrigerant", "Refrigerant"],
  ["safety", "Safety Domain"],
]);

export const EvidenceType = define([
  ["none", "No Evidence"],
  ["work_history", "Work History"],
  ["employer_confirmation", "Employer Confirmation"],
  ["credential", "Credential"],
  ["practical_assessment", "Practical Assessment"],
]);

export const CapabilityStatus = define([
  ["verified", "Verified"],
  ["pending", "Pending"],
  ["not_qualified", "Not Qualified"],
]);

export const CredentialStatus = define([
  ["pending", "Pending"],
  ["document_verified", "Document Verified"],
  ["issuer_confirmed", "Issuer Confirmed"],
  ["platform_verified", "Platform Verified"],
  ["expired", "Expired"],
  ["suspended", "Suspended"],
  ["revoked", "Revoked"],
  ["rejected", "Rejected"],
]);

export const Criticality = define([
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["critical", "Critical"],
]);

export const Urgency = define([
  ["routine", "Routine"],
  ["scheduled", "Scheduled"],
  ["urgent", "Urgent"],
  ["emergency", "Emergency"],
]);

export const RiskLevel = define([
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["very_high", "Very High"],
  ["critical", "Critical"],
]);

export const JobStatus = define([
  ["open", "Open"],
  ["assigned", "Assigned"],
  ["in_progress", "In Progress"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
]);

export const ReportStatus = define([
  ["submitted", "Submitted"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
]);

export const ContractorVerificationStatus = define([
  ["pending", "Pending"],
  ["verified", "Verified"],
  ["suspended", "Suspended"],
]);

export const FacilitySegment = define([
  ["cold_storage", "Cold Storage"],
  ["supermarket_refrigeration", "Supermarket Refrigeration"],
  ["other", "Other"],
]);

export const ContractorDocType = define([
  ["business_registration", "Business Registration"],
  ["insurance", "Insurance"],
  ["safety_policy", "Safety Policy"],
  ["other", "Other"],
]);

export const ContractorDocStatus = define([
  ["pending", "Pending"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
]);

export const CylinderKind = define([
  ["supply", "Supply (new refrigerant)"],
  ["recovery", "Recovery (recovered refrigerant)"],
]);

export const CylinderTransactionKind = define([
  ["initial_fill", "Initial fill"],
  ["draw", "Drawn for a service job"],
  ["recovery", "Recovered from a service job"],
]);

export const NotificationKind = define([
  ["job", "Job"],
  ["credential", "Credential"],
  ["report", "Report"],
  ["feedback", "Feedback"],
  ["info", "Info"],
]);

export const HIGH_RISK_LEVELS = ["high", "very_high", "critical"];
