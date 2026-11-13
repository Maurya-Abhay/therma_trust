from decimal import Decimal

import pytest

from apps.core.choices import Criticality, JobStatus, Urgency
from apps.core.models import AuditLog
from apps.jobs.models import JobAssignment, JobRequest
from apps.jobs.services.risk import classify
from apps.servicereports.models import CylinderTransaction, RefrigerantCylinder, ServiceReport

from .conftest import make_equipment


def make_cylinder(company, refrigerant, kind=RefrigerantCylinder.Kind.SUPPLY, capacity="20.00", current="10.00", serial="CYL-1"):
    return RefrigerantCylinder.objects.create(
        company=company, serial_number=serial, refrigerant_type=refrigerant, kind=kind,
        capacity_kg=Decimal(capacity), current_kg=Decimal(current),
    )


def make_job(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    risk_level, required_capabilities, _ = classify(equipment, Urgency.SCHEDULED)
    job = JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=facility_manager, description="test job",
        urgency=Urgency.SCHEDULED, risk_level=risk_level, required_capabilities=required_capabilities,
        status=JobStatus.ASSIGNED,
    )
    JobAssignment.objects.create(job=job, technician=technician, assigned_by=facility_manager)
    return job


def submit_report(api_client, technician, job, refrigerant, **overrides):
    api_client.force_authenticate(user=technician.user)
    payload = {
        "job": job.id, "fault_description": "test fault", "refrigerant_type": refrigerant.id,
        "refrigerant_added_kg": "0", "refrigerant_recovered_kg": "0", "summary": "done",
    }
    payload.update(overrides)
    return api_client.post("/api/service-reports/", payload, format="json")


@pytest.mark.django_db
def test_contractor_manager_registers_cylinder_with_initial_fill(api_client, contractor, refrigerants):
    api_client.force_authenticate(user=contractor.manager)

    response = api_client.post(
        "/api/cylinders/",
        {
            "company": contractor.id, "serial_number": "CYL-100", "refrigerant_type": refrigerants["R-134a"].id,
            "kind": "supply", "capacity_kg": "13.60", "current_kg": "13.60",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    cylinder = RefrigerantCylinder.objects.get(pk=response.data["id"])
    ledger = cylinder.transactions.get()
    assert ledger.kind == CylinderTransaction.Kind.INITIAL_FILL
    assert ledger.balance_after_kg == Decimal("13.60")
    assert AuditLog.objects.filter(action="cylinder.register", object_id=str(cylinder.pk)).exists()


@pytest.mark.django_db
def test_starting_amount_cannot_exceed_capacity(api_client, contractor, refrigerants):
    api_client.force_authenticate(user=contractor.manager)

    response = api_client.post(
        "/api/cylinders/",
        {
            "company": contractor.id, "serial_number": "CYL-101", "refrigerant_type": refrigerants["R-134a"].id,
            "kind": "supply", "capacity_kg": "10", "current_kg": "12",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "current_kg" in response.data


@pytest.mark.django_db
def test_technician_cannot_register_cylinder(api_client, technician, contractor, refrigerants):
    api_client.force_authenticate(user=technician.user)

    response = api_client.post(
        "/api/cylinders/",
        {
            "company": contractor.id, "serial_number": "CYL-102", "refrigerant_type": refrigerants["R-134a"].id,
            "kind": "supply", "capacity_kg": "10", "current_kg": "10",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_report_draws_down_supply_cylinder_and_writes_ledger(
    api_client, facility, refrigerants, technician, facility_manager, contractor
):
    cylinder = make_cylinder(contractor, refrigerants["R-134a"], current="10.00")
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_added_kg="2.50", added_from_cylinder=cylinder.id,
    )

    assert response.status_code == 201, response.data
    assert response.data["added_from_cylinder_serial"] == "CYL-1"
    cylinder.refresh_from_db()
    assert cylinder.current_kg == Decimal("7.50")
    draw = cylinder.transactions.get(kind=CylinderTransaction.Kind.DRAW)
    assert draw.amount_kg == Decimal("2.50")
    assert draw.balance_after_kg == Decimal("7.50")
    assert draw.service_report_id == response.data["id"]
    assert AuditLog.objects.filter(action="cylinder.draw", object_id=str(cylinder.pk)).exists()


@pytest.mark.django_db
def test_report_fills_recovery_cylinder(api_client, facility, refrigerants, technician, facility_manager, contractor):
    cylinder = make_cylinder(
        contractor, refrigerants["R-134a"], kind=RefrigerantCylinder.Kind.RECOVERY, current="1.00", serial="REC-1"
    )
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_recovered_kg="3.00", recovered_into_cylinder=cylinder.id,
    )

    assert response.status_code == 201, response.data
    cylinder.refresh_from_db()
    assert cylinder.current_kg == Decimal("4.00")
    assert cylinder.transactions.filter(kind=CylinderTransaction.Kind.RECOVERY).count() == 1


@pytest.mark.django_db
def test_cannot_draw_more_than_the_cylinder_holds(
    api_client, facility, refrigerants, technician, facility_manager, contractor
):
    cylinder = make_cylinder(contractor, refrigerants["R-134a"], current="1.00")
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_added_kg="5.00", added_from_cylinder=cylinder.id,
    )

    assert response.status_code == 400
    assert "only has" in str(response.data["added_from_cylinder"])
    cylinder.refresh_from_db()
    assert cylinder.current_kg == Decimal("1.00")
    assert not ServiceReport.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_cylinder_refrigerant_must_match_the_report(
    api_client, facility, refrigerants, technician, facility_manager, contractor
):
    cylinder = make_cylinder(contractor, refrigerants["R-32"], current="10.00")
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_added_kg="1.00", added_from_cylinder=cylinder.id,
    )

    assert response.status_code == 400
    assert "holds R-32" in str(response.data["added_from_cylinder"])


@pytest.mark.django_db
def test_recovered_gas_cannot_go_into_a_supply_cylinder(
    api_client, facility, refrigerants, technician, facility_manager, contractor
):
    cylinder = make_cylinder(contractor, refrigerants["R-134a"], kind=RefrigerantCylinder.Kind.SUPPLY)
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_recovered_kg="1.00", recovered_into_cylinder=cylinder.id,
    )

    assert response.status_code == 400
    assert "not a recovery cylinder" in str(response.data["recovered_into_cylinder"])


@pytest.mark.django_db
def test_recovery_cylinder_cannot_overflow(api_client, facility, refrigerants, technician, facility_manager, contractor):
    cylinder = make_cylinder(
        contractor, refrigerants["R-134a"], kind=RefrigerantCylinder.Kind.RECOVERY, capacity="5.00", current="4.50"
    )
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_recovered_kg="2.00", recovered_into_cylinder=cylinder.id,
    )

    assert response.status_code == 400
    assert "free space" in str(response.data["recovered_into_cylinder"])


@pytest.mark.django_db
def test_cannot_use_another_companys_cylinder(
    api_client, facility, refrigerants, technician, facility_manager, contractor
):
    from apps.accounts.models import User
    from apps.contractors.models import ContractorCompany

    other_manager = User.objects.create_user(
        username="other_cm", email="other_cm@test.local", password="pass12345", role=User.Role.CONTRACTOR_MANAGER
    )
    other_company = ContractorCompany.objects.create(manager=other_manager, name="Other Co", service_area="Elsewhere")
    cylinder = make_cylinder(other_company, refrigerants["R-134a"], current="10.00")
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_added_kg="1.00", added_from_cylinder=cylinder.id,
    )

    assert response.status_code == 400
    assert "does not belong to your company" in str(response.data["added_from_cylinder"])


@pytest.mark.django_db
def test_cylinder_amount_must_be_positive(api_client, facility, refrigerants, technician, facility_manager, contractor):
    cylinder = make_cylinder(contractor, refrigerants["R-134a"])
    job = make_job(facility, refrigerants, facility_manager, technician)

    response = submit_report(
        api_client, technician, job, refrigerants["R-134a"], added_from_cylinder=cylinder.id,
    )

    assert response.status_code == 400
    assert "greater than 0" in str(response.data["added_from_cylinder"])


@pytest.mark.django_db
def test_logged_amounts_cannot_be_edited_afterwards(
    api_client, facility, refrigerants, technician, facility_manager, contractor
):
    cylinder = make_cylinder(contractor, refrigerants["R-134a"], current="10.00")
    job = make_job(facility, refrigerants, facility_manager, technician)
    created = submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_added_kg="2.00", added_from_cylinder=cylinder.id,
    )
    assert created.status_code == 201

    response = api_client.patch(
        f"/api/service-reports/{created.data['id']}/", {"refrigerant_added_kg": "9.00"}, format="json"
    )

    assert response.status_code == 400
    assert "refrigerant_added_kg" in response.data


@pytest.mark.django_db
def test_history_lists_ledger_newest_first(api_client, facility, refrigerants, technician, facility_manager, contractor):
    cylinder = make_cylinder(contractor, refrigerants["R-134a"], current="10.00")
    CylinderTransaction.objects.create(
        cylinder=cylinder, kind=CylinderTransaction.Kind.INITIAL_FILL, amount_kg=Decimal("10.00"),
        balance_after_kg=Decimal("10.00"),
    )
    job = make_job(facility, refrigerants, facility_manager, technician)
    submit_report(
        api_client, technician, job, refrigerants["R-134a"],
        refrigerant_added_kg="2.00", added_from_cylinder=cylinder.id,
    )

    api_client.force_authenticate(user=contractor.manager)
    response = api_client.get(f"/api/cylinders/{cylinder.id}/history/")

    assert response.status_code == 200
    assert [row["kind"] for row in response.data] == ["draw", "initial_fill"]
    assert response.data[0]["technician_name"] == technician.user.email


@pytest.mark.django_db
def test_technician_only_sees_their_companys_cylinders(api_client, technician, contractor, refrigerants):
    from apps.accounts.models import User
    from apps.contractors.models import ContractorCompany

    own = make_cylinder(contractor, refrigerants["R-134a"], serial="OWN-1")
    other_manager = User.objects.create_user(
        username="other_cm2", email="other_cm2@test.local", password="pass12345", role=User.Role.CONTRACTOR_MANAGER
    )
    other_company = ContractorCompany.objects.create(manager=other_manager, name="Other Co", service_area="Elsewhere")
    make_cylinder(other_company, refrigerants["R-134a"], serial="THEIRS-1")

    api_client.force_authenticate(user=technician.user)
    response = api_client.get("/api/cylinders/")

    assert response.status_code == 200
    assert [c["id"] for c in response.data["results"]] == [own.id]
