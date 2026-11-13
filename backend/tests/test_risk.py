import pytest

from apps.core.choices import CapabilityType, Criticality, RiskLevel, SafetyDomain, Urgency
from apps.jobs.services.risk import classify

from .conftest import make_equipment


@pytest.mark.django_db
def test_low_criticality_standard_refrigerant_is_low_risk(facility, refrigerants):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.LOW)
    risk_level, required, _ = classify(equipment, Urgency.ROUTINE)

    assert risk_level == RiskLevel.LOW
    assert {"capability_type": CapabilityType.EQUIPMENT, "key": equipment.category} in required
    assert {"capability_type": CapabilityType.REFRIGERANT, "key": refrigerants["R-134a"].id} in required
    assert not any(r["capability_type"] == CapabilityType.SAFETY for r in required)


@pytest.mark.django_db
def test_ammonia_equipment_requires_ammonia_safety_and_is_high_risk(facility, refrigerants):
    equipment = make_equipment(facility, refrigerants["R-717"], criticality=Criticality.CRITICAL)
    risk_level, required, _ = classify(equipment, Urgency.URGENT)

    assert risk_level in (RiskLevel.VERY_HIGH, RiskLevel.CRITICAL)
    safety_keys = [r["key"] for r in required if r["capability_type"] == CapabilityType.SAFETY]
    assert SafetyDomain.AMMONIA_SAFETY in safety_keys
    assert SafetyDomain.REFRIGERANT_RECOVERY in safety_keys


@pytest.mark.django_db
def test_a2l_refrigerant_requires_a2l_safety(facility, refrigerants):
    equipment = make_equipment(facility, refrigerants["R-32"], criticality=Criticality.MEDIUM)
    _, required, _ = classify(equipment, Urgency.SCHEDULED)

    safety_keys = [r["key"] for r in required if r["capability_type"] == CapabilityType.SAFETY]
    assert SafetyDomain.A2L_SAFETY in safety_keys


@pytest.mark.django_db
def test_higher_urgency_increases_or_maintains_risk(facility, refrigerants):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    routine_level, _, routine_breakdown = classify(equipment, Urgency.ROUTINE)
    emergency_level, _, emergency_breakdown = classify(equipment, Urgency.EMERGENCY)

    assert emergency_breakdown["total"] >= routine_breakdown["total"]
    order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH, RiskLevel.CRITICAL]
    assert order.index(emergency_level) >= order.index(routine_level)
