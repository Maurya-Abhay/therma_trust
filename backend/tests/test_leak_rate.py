import datetime

import pytest
from django.utils import timezone

from apps.core.choices import Criticality, JobStatus, Urgency
from apps.facilities.services.leak_rate import DEFAULT_LEAK_RATE_THRESHOLD_PERCENT, compute_leak_rate
from apps.jobs.models import JobRequest
from apps.jobs.services.risk import classify
from apps.servicereports.models import ServiceReport

from .conftest import make_equipment


def make_job(facility, equipment, created_by):
    risk_level, required_capabilities, _ = classify(equipment, Urgency.SCHEDULED)
    return JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=created_by,
        description="test job", urgency=Urgency.SCHEDULED,
        risk_level=risk_level, required_capabilities=required_capabilities,
        status=JobStatus.OPEN,
    )


def make_report(facility, equipment, created_by, technician, refrigerant, added_kg, created_at=None):
    # ServiceReport.job is a OneToOneField — each service visit is its own
    # job, so multiple reports on the same equipment need separate jobs.
    job = make_job(facility, equipment, created_by)
    report = ServiceReport.objects.create(
        job=job, technician=technician, fault_description="test", refrigerant_type=refrigerant,
        refrigerant_added_kg=added_kg, refrigerant_recovered_kg="0", summary="serviced",
    )
    if created_at:
        ServiceReport.objects.filter(pk=report.pk).update(created_at=created_at)
        report.refresh_from_db()
    return report


@pytest.mark.django_db
def test_leak_rate_is_none_without_a_recorded_charge(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "5.0")

    result = compute_leak_rate(equipment)

    assert result["leak_rate_percent"] is None
    assert result["exceeds_threshold"] is False
    assert "No refrigerant charge recorded" in result["note"]


@pytest.mark.django_db
def test_leak_rate_calculated_from_added_over_charge(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "5.0")

    result = compute_leak_rate(equipment)

    assert result["leak_rate_percent"] == 10.0
    assert result["exceeds_threshold"] is False


@pytest.mark.django_db
def test_leak_rate_flags_equipment_over_threshold(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "15.0")  # 30% > 20%

    result = compute_leak_rate(equipment)

    assert result["leak_rate_percent"] == 30.0
    assert result["exceeds_threshold"] is True
    assert result["threshold_percent"] == float(DEFAULT_LEAK_RATE_THRESHOLD_PERCENT)


@pytest.mark.django_db
def test_leak_rate_ignores_reports_outside_rolling_window(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])

    old_date = timezone.now() - datetime.timedelta(days=400)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "20.0", created_at=old_date)
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "2.0")

    result = compute_leak_rate(equipment)

    # Only the recent 2kg counts; the 20kg top-up is outside the 365-day window.
    assert result["added_kg_12mo"] == 2.0
    assert result["leak_rate_percent"] == 4.0


@pytest.mark.django_db
def test_dashboard_includes_leak_rate_by_equipment(api_client, facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "15.0")

    api_client.force_authenticate(user=facility_manager)
    response = api_client.get("/api/dashboard/refrigerant-summary/")

    assert response.status_code == 200
    rows = response.data["leak_rate_by_equipment"]
    assert len(rows) == 1
    assert rows[0]["equipment_id"] == equipment.id
    assert rows[0]["exceeds_threshold"] is True


@pytest.mark.django_db
def test_compliance_export_returns_csv(api_client, facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])
    make_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "15.0")

    api_client.force_authenticate(user=facility_manager)
    response = api_client.get("/api/dashboard/refrigerant-summary/export/")

    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv"
    assert equipment.name.encode() in response.content
