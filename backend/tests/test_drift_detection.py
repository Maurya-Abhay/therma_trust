import pytest

from apps.core.choices import Criticality, JobStatus, Urgency
from apps.jobs.models import JobRequest
from apps.jobs.services.risk import classify
from apps.servicereports.models import ServiceReport
from apps.servicereports.services.drift import detect_drift

from .conftest import make_equipment


def make_job(facility, equipment, created_by):
    risk_level, required_capabilities, _ = classify(equipment, Urgency.SCHEDULED)
    return JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=created_by,
        description="test job", urgency=Urgency.SCHEDULED,
        risk_level=risk_level, required_capabilities=required_capabilities,
        status=JobStatus.OPEN,
    )


def make_report(facility, equipment, created_by, technician, refrigerant, readings):
    # ServiceReport.job is a OneToOneField — each service visit is its own
    # job, so multiple reports on the same equipment need separate jobs.
    job = make_job(facility, equipment, created_by)
    return ServiceReport.objects.create(
        job=job, technician=technician, fault_description="test", refrigerant_type=refrigerant,
        refrigerant_added_kg="0", refrigerant_recovered_kg="0", summary="serviced",
        diagnostic_readings=readings,
    )


@pytest.mark.django_db
def test_no_warnings_with_fewer_than_three_reports(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "10"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "12"})

    assert detect_drift(equipment) == []


@pytest.mark.django_db
def test_detects_increasing_trend(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "8"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "11"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "15"})

    flags = detect_drift(equipment)

    assert len(flags) == 1
    assert flags[0]["metric"] == "superheat"
    assert flags[0]["direction"] == "increasing"
    assert flags[0]["values"] == [8.0, 11.0, 15.0]


@pytest.mark.django_db
def test_detects_decreasing_trend(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"Amps": "12.5 A"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"Amps": "10 A"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"Amps": "7.2 A"})

    flags = detect_drift(equipment)

    assert len(flags) == 1
    assert flags[0]["metric"] == "amps"
    assert flags[0]["direction"] == "decreasing"


@pytest.mark.django_db
def test_no_flag_when_trend_is_not_monotonic(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "10"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "14"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "9"})

    assert detect_drift(equipment) == []


@pytest.mark.django_db
def test_metric_missing_from_one_report_is_skipped(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "8"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "15"})

    assert detect_drift(equipment) == []


@pytest.mark.django_db
def test_only_the_most_recent_three_reports_are_considered(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    # Oldest reading would break a monotonic trend if it were included.
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "99"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "8"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "11"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "15"})

    flags = detect_drift(equipment)

    assert len(flags) == 1
    assert flags[0]["values"] == [8.0, 11.0, 15.0]


@pytest.mark.django_db
def test_equipment_api_includes_drift_warnings(api_client, facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "8"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "11"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "15"})

    api_client.force_authenticate(user=facility_manager)
    response = api_client.get(f"/api/equipment/?facility={facility.id}")

    assert response.status_code == 200
    result = next(r for r in response.data["results"] if r["id"] == equipment.id)
    assert result["drift_warnings"][0]["metric"] == "superheat"


@pytest.mark.django_db
def test_job_api_includes_equipment_drift_warnings(api_client, facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "8"})
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "11"})
    report = make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"superheat": "15"})

    api_client.force_authenticate(user=facility_manager)
    response = api_client.get(f"/api/jobs/{report.job_id}/")

    assert response.status_code == 200
    assert response.data["equipment_drift_warnings"][0]["metric"] == "superheat"
