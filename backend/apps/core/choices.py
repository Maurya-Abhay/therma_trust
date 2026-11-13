from django.db import models


class EquipmentCategory(models.TextChoices):
    COMMERCIAL_CHILLER = "commercial_chiller", "Commercial Chiller"
    COLD_STORAGE_UNIT = "cold_storage_unit", "Cold Storage Unit"
    SUPERMARKET_REFRIGERATION = "supermarket_refrigeration", "Supermarket Refrigeration"
    VRF_SYSTEM = "vrf_system", "VRF System"
    DATA_CENTER_COOLING = "data_center_cooling", "Data Center Cooling"
    AMMONIA_SYSTEM = "ammonia_system", "Ammonia System"
    CO2_REFRIGERATION = "co2_refrigeration", "CO2 Refrigeration"


class SafetyDomain(models.TextChoices):
    A2L_SAFETY = "a2l_safety", "A2L Refrigerant Safety"
    AMMONIA_SAFETY = "ammonia_safety", "Ammonia Safety"
    CO2_HIGH_PRESSURE = "co2_high_pressure", "CO2 High-Pressure Operation"
    ELECTRICAL_DIAGNOSTICS = "electrical_diagnostics", "Electrical Diagnostics"
    REFRIGERANT_RECOVERY = "refrigerant_recovery", "Refrigerant Recovery"
    VACUUM_EVACUATION = "vacuum_evacuation", "Vacuum Evacuation"
    LEAK_DETECTION = "leak_detection", "Leak Detection"


class CapabilityType(models.TextChoices):
    EQUIPMENT = "equipment", "Equipment"
    REFRIGERANT = "refrigerant", "Refrigerant"
    SAFETY = "safety", "Safety Domain"


class EvidenceType(models.TextChoices):
    NONE = "none", "No Evidence"
    WORK_HISTORY = "work_history", "Work History"
    EMPLOYER_CONFIRMATION = "employer_confirmation", "Employer Confirmation"
    CREDENTIAL = "credential", "Credential"
    PRACTICAL_ASSESSMENT = "practical_assessment", "Practical Assessment"


class CapabilityStatus(models.TextChoices):
    VERIFIED = "verified", "Verified"
    PENDING = "pending", "Pending"
    NOT_QUALIFIED = "not_qualified", "Not Qualified"


class CredentialStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    DOCUMENT_VERIFIED = "document_verified", "Document Verified"
    ISSUER_CONFIRMED = "issuer_confirmed", "Issuer Confirmed"
    PLATFORM_VERIFIED = "platform_verified", "Platform Verified"
    EXPIRED = "expired", "Expired"
    SUSPENDED = "suspended", "Suspended"
    REVOKED = "revoked", "Revoked"
    REJECTED = "rejected", "Rejected"


class Criticality(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class Urgency(models.TextChoices):
    ROUTINE = "routine", "Routine"
    SCHEDULED = "scheduled", "Scheduled"
    URGENT = "urgent", "Urgent"
    EMERGENCY = "emergency", "Emergency"


class RiskLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    VERY_HIGH = "very_high", "Very High"
    CRITICAL = "critical", "Critical"


class JobStatus(models.TextChoices):
    OPEN = "open", "Open"
    ASSIGNED = "assigned", "Assigned"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class ReportStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class ContractorVerificationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    VERIFIED = "verified", "Verified"
    SUSPENDED = "suspended", "Suspended"
