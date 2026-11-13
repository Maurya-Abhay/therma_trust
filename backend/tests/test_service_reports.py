import pytest

from apps.core.choices import Criticality, JobStatus, ReportStatus, Urgency
from apps.jobs.models import JobAssignment, JobRequest
from apps.jobs.services.risk import classify
from apps.servicereports.models import ServiceReport

from .conftest import make_equipment


def make_assigned_job(facility, equipment, created_by, technician, urgency=Urgency.SCHEDULED):
    risk_level, required_capabilities, _ = classify(equipment, urgency)
    job = JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=created_by,
        description="test job", urgency=urgency,
        risk_level=risk_level, required_capabilities=required_capabilities,
        status=JobStatus.ASSIGNED,
    )
    JobAssignment.objects.create(job=job, technician=technician, assigned_by=created_by)
    return job


@pytest.mark.django_db
def test_technician_can_submit_report_for_assigned_job(api_client, facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    job = make_assigned_job(facility, equipment, facility_manager, technician)

    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        "/api/service-reports/",
        {
            "job": job.id, "fault_description": "test fault", "refrigerant_type": refrigerants["R-134a"].id,
            "refrigerant_added_kg": "1.0", "refrigerant_recovered_kg": "0.5",
            "leak_test_result": "pass", "vacuum_result": "pass", "summary": "fixed it",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    job.refresh_from_db()
    assert job.status == JobStatus.IN_PROGRESS


@pytest.mark.django_db
def test_unassigned_technician_cannot_submit_report(api_client, facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    risk_level, required_capabilities, _ = classify(equipment, Urgency.SCHEDULED)
    job = JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=facility_manager,
        description="test job", urgency=Urgency.SCHEDULED,
        risk_level=risk_level, required_capabilities=required_capabilities,
    )

    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        "/api/service-reports/",
        {
            "job": job.id, "fault_description": "test fault", "refrigerant_type": refrigerants["R-134a"].id,
            "summary": "fixed it",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_facility_manager_approval_completes_job(api_client, facility, refrigerants, technician, facility_manager):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    job = make_assigned_job(facility, equipment, facility_manager, technician)
    report = ServiceReport.objects.create(
        job=job, technician=technician, fault_description="test", refrigerant_type=refrigerants["R-134a"],
        refrigerant_added_kg="1.0", refrigerant_recovered_kg="0.5", summary="fixed",
    )

    api_client.force_authenticate(user=facility_manager)
    response = api_client.post(f"/api/service-reports/{report.id}/approve/")

    assert response.status_code == 200
    report.refresh_from_db()
    job.refresh_from_db()
    assert report.status == ReportStatus.APPROVED
    assert job.status == JobStatus.COMPLETED


@pytest.mark.django_db
def test_other_facility_manager_cannot_approve_report(api_client, facility, refrigerants, technician, facility_manager):
    from apps.accounts.models import User

    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    job = make_assigned_job(facility, equipment, facility_manager, technician)
    report = ServiceReport.objects.create(
        job=job, technician=technician, fault_description="test", refrigerant_type=refrigerants["R-134a"],
        summary="fixed",
    )

    other_fm = User.objects.create_user(
        username="other_fm", email="other_fm@test.local", password="pass12345", role=User.Role.FACILITY_MANAGER
    )
    api_client.force_authenticate(user=other_fm)
    response = api_client.post(f"/api/service-reports/{report.id}/approve/")

    assert response.status_code in (403, 404)
