"""Rule-based job risk classification.

Not machine-learned — a transparent, explainable scoring rule so facility
managers and auditors can see exactly why a job was classified a given way.
"""
from apps.core.choices import CapabilityType, Criticality, RiskLevel, SafetyDomain, Urgency

CRITICALITY_WEIGHT = {
    Criticality.LOW: 1,
    Criticality.MEDIUM: 2,
    Criticality.HIGH: 3,
    Criticality.CRITICAL: 4,
}

URGENCY_WEIGHT = {
    Urgency.ROUTINE: 1,
    Urgency.SCHEDULED: 1,
    Urgency.URGENT: 2,
    Urgency.EMERGENCY: 3,
}


def _refrigerant_weight(refrigerant_type):
    if refrigerant_type.is_ammonia or refrigerant_type.is_high_pressure:
        return 4
    if refrigerant_type.is_a2l:
        return 3
    return 1


def _refrigerant_safety_domain(refrigerant_type):
    if refrigerant_type.is_ammonia:
        return SafetyDomain.AMMONIA_SAFETY
    if refrigerant_type.is_high_pressure:
        return SafetyDomain.CO2_HIGH_PRESSURE
    if refrigerant_type.is_a2l:
        return SafetyDomain.A2L_SAFETY
    return None


def _risk_band(total):
    if total <= 4:
        return RiskLevel.LOW
    if total <= 6:
        return RiskLevel.MEDIUM
    if total <= 8:
        return RiskLevel.HIGH
    if total <= 10:
        return RiskLevel.VERY_HIGH
    return RiskLevel.CRITICAL


def classify(equipment, urgency):
    """Returns (risk_level, required_capabilities, breakdown)."""
    refrigerant = equipment.refrigerant_type
    criticality_w = CRITICALITY_WEIGHT.get(equipment.criticality, 2)
    refrigerant_w = _refrigerant_weight(refrigerant)
    urgency_w = URGENCY_WEIGHT.get(urgency, 1)
    total = criticality_w + refrigerant_w + urgency_w

    risk_level = _risk_band(total)

    required_capabilities = [
        {"capability_type": CapabilityType.EQUIPMENT, "key": equipment.category},
        {"capability_type": CapabilityType.REFRIGERANT, "key": refrigerant.id},
    ]
    safety_domain = _refrigerant_safety_domain(refrigerant)
    if safety_domain:
        required_capabilities.append({"capability_type": CapabilityType.SAFETY, "key": safety_domain})
    if risk_level in (RiskLevel.HIGH, RiskLevel.VERY_HIGH, RiskLevel.CRITICAL):
        required_capabilities.append(
            {"capability_type": CapabilityType.SAFETY, "key": SafetyDomain.REFRIGERANT_RECOVERY}
        )

    breakdown = {
        "criticality_weight": criticality_w,
        "refrigerant_weight": refrigerant_w,
        "urgency_weight": urgency_w,
        "total": total,
    }
    return risk_level, required_capabilities, breakdown
