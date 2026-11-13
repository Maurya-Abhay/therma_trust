import pytest

from apps.core.choices import CapabilityStatus, CapabilityType, Criticality, EvidenceType, Urgency
from apps.jobs.models import JobRequest
from apps.jobs.services.matching import score_technician
from apps.jobs.services.risk import classify
from apps.technicians.models import CapabilitySkill

from .conftest import make_equipment


def make_job(facility, equipment, created_by, urgency=Urgency.SCHEDULED):
    risk_level, required_capabilities, _ = classify(equipment, urgency)
    return JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=created_by,
        description="test job", urgency=urgency,
        risk_level=risk_level, required_capabilities=required_capabilities,
    )


@pytest.mark.django_db
def test_technician_missing_all_capabilities_is_not_qualified(facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-717"], criticality=Criticality.CRITICAL)
    job = make_job(facility, equipment, facility_manager, Urgency.URGENT)

    result = score_technician(technician, job)

    assert result["is_qualified"] is False
    assert len(result["missing_requirements"]) == len(job.required_capabilities)


@pytest.mark.django_db
def test_technician_with_verified_capabilities_is_qualified(facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.LOW)
    job = make_job(facility, equipment, facility_manager, Urgency.ROUTINE)

    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.EQUIPMENT,
        equipment_category=equipment.category, evidence_type=EvidenceType.WORK_HISTORY,
        status=CapabilityStatus.VERIFIED,
    )
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.REFRIGERANT,
        refrigerant_type=refrigerants["R-134a"], evidence_type=EvidenceType.CREDENTIAL,
        status=CapabilityStatus.VERIFIED,
    )

    result = score_technician(technician, job)

    assert result["is_qualified"] is True
    assert result["missing_requirements"] == []
    assert result["score"] > 0


@pytest.mark.django_db
def test_pending_capability_scores_less_than_verified_and_still_missing(facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.LOW)
    job = make_job(facility, equipment, facility_manager, Urgency.ROUTINE)

    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.EQUIPMENT,
        equipment_category=equipment.category, evidence_type=EvidenceType.WORK_HISTORY,
        status=CapabilityStatus.PENDING,
    )

    result = score_technician(technician, job)

    assert result["is_qualified"] is False
    assert any(r["capability_type"] == CapabilityType.EQUIPMENT for r in result["missing_requirements"])
