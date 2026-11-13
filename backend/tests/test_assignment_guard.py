import pytest

from apps.core.choices import CapabilityStatus, CapabilityType, Criticality, EvidenceType, JobStatus, Urgency
from apps.jobs.models import JobRequest
from apps.jobs.services.risk import classify
from apps.technicians.models import CapabilitySkill

from .conftest import make_equipment


def make_job(facility, equipment, created_by, urgency):
    risk_level, required_capabilities, _ = classify(equipment, urgency)
    return JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=created_by,
        description="test job", urgency=urgency,
        risk_level=risk_level, required_capabilities=required_capabilities,
    )


@pytest.mark.django_db
def test_assign_underqualified_technician_to_high_risk_job_is_blocked(
    api_client, facility, refrigerants, technician, facility_manager
):
    equipment = make_equipment(facility, refrigerants["R-717"], criticality=Criticality.CRITICAL)
    job = make_job(facility, equipment, facility_manager, Urgency.URGENT)
    assert job.risk_level in ("high", "very_high", "critical")

    api_client.force_authenticate(user=facility_manager)
    response = api_client.post(
        f"/api/jobs/{job.id}/assign/", {"technician_id": technician.id}, format="json"
    )

    assert response.status_code == 409
    assert response.data["requires_override"] is True
    job.refresh_from_db()
    assert job.status == JobStatus.OPEN


@pytest.mark.django_db
def test_assign_with_override_and_reason_succeeds_and_is_flagged(
    api_client, facility, refrigerants, technician, facility_manager
):
    equipment = make_equipment(facility, refrigerants["R-717"], criticality=Criticality.CRITICAL)
    job = make_job(facility, equipment, facility_manager, Urgency.URGENT)

    api_client.force_authenticate(user=facility_manager)
    response = api_client.post(
        f"/api/jobs/{job.id}/assign/",
        {"technician_id": technician.id, "override_warning": True, "override_reason": "No qualified tech available"},
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["override_warning"] is True
    job.refresh_from_db()
    assert job.status == JobStatus.ASSIGNED


@pytest.mark.django_db
def test_override_without_reason_is_rejected(api_client, facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-717"], criticality=Criticality.CRITICAL)
    job = make_job(facility, equipment, facility_manager, Urgency.URGENT)

    api_client.force_authenticate(user=facility_manager)
    response = api_client.post(
        f"/api/jobs/{job.id}/assign/",
        {"technician_id": technician.id, "override_warning": True, "override_reason": ""},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_qualified_technician_assigns_without_override_on_high_risk_job(
    api_client, facility, refrigerants, technician, facility_manager
):
    equipment = make_equipment(facility, refrigerants["R-717"], criticality=Criticality.CRITICAL)
    job = make_job(facility, equipment, facility_manager, Urgency.URGENT)

    for req in job.required_capabilities:
        kwargs = dict(technician=technician, capability_type=req["capability_type"], evidence_type=EvidenceType.CREDENTIAL, status=CapabilityStatus.VERIFIED)
        if req["capability_type"] == CapabilityType.EQUIPMENT:
            kwargs["equipment_category"] = req["key"]
        elif req["capability_type"] == CapabilityType.REFRIGERANT:
            kwargs["refrigerant_type_id"] = req["key"]
        else:
            kwargs["safety_domain"] = req["key"]
        CapabilitySkill.objects.create(**kwargs)

    api_client.force_authenticate(user=facility_manager)
    response = api_client.post(
        f"/api/jobs/{job.id}/assign/", {"technician_id": technician.id}, format="json"
    )

    assert response.status_code == 201, response.data
    assert response.data["override_warning"] is False
