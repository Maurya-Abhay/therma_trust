import datetime
from decimal import Decimal

import pytest
from django.core import mail
from django.utils import timezone

from apps.core.choices import (
    CapabilityStatus, CapabilityType, ContractorVerificationStatus, CredentialStatus, Criticality, SafetyDomain,
)
from apps.core.models import AuditLog
from apps.core.services.alerts import compute_alerts
from apps.servicereports.models import RefrigerantCylinder
from apps.technicians.models import CapabilitySkill, Credential

from .conftest import make_equipment
from .test_drift_detection import make_report as make_reading_report
from .test_leak_rate import make_report as make_topup_report


def ids(alerts):
    return {a["id"] for a in alerts}


def credential(technician, expires_in_days, status=CredentialStatus.PLATFORM_VERIFIED, name="EPA 608"):
    return Credential.objects.create(
        technician=technician, name=name, issuer_name="EPA", file="credentials/x.pdf", status=status,
        expiry_date=timezone.now().date() + datetime.timedelta(days=expires_in_days),
    )


# ---- facility manager ----

@pytest.mark.django_db
def test_facility_manager_gets_critical_alert_for_leaky_equipment(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])
    make_topup_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "15.0")  # 30%

    alerts = compute_alerts(facility_manager)

    leak = next(a for a in alerts if a["id"] == f"leak:{equipment.id}")
    assert leak["severity"] == "critical"
    assert "30" in leak["detail"]


@pytest.mark.django_db
def test_no_leak_alert_when_within_limit(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    equipment.refrigerant_charge_kg = "50.00"
    equipment.save(update_fields=["refrigerant_charge_kg"])
    make_topup_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], "2.0")

    assert compute_alerts(facility_manager) == []


@pytest.mark.django_db
def test_facility_manager_gets_drift_warning(facility, refrigerants, facility_manager, technician):
    equipment = make_equipment(facility, refrigerants["R-134a"], criticality=Criticality.MEDIUM)
    for amps in ("10", "12", "15"):
        make_reading_report(facility, equipment, facility_manager, technician, refrigerants["R-134a"], {"amps": amps})

    alerts = compute_alerts(facility_manager)

    drift = next(a for a in alerts if a["id"] == f"drift:{equipment.id}:amps")
    assert drift["severity"] == "warning"
    assert "increasing" in drift["title"]


# ---- technician ----

@pytest.mark.django_db
def test_technician_alerted_about_expiring_and_expired_credentials(technician):
    expiring = credential(technician, 10, name="Expiring")
    expired = credential(technician, -3, name="Expired")
    credential(technician, 400, name="Fine")
    credential(technician, 5, status=CredentialStatus.PENDING, name="Never verified")

    alerts = compute_alerts(technician.user)

    assert ids(alerts) == {f"mycred:expiring:{expiring.id}", f"mycred:expired:{expired.id}"}
    assert alerts[0]["severity"] == "critical"  # sorted most severe first
    assert alerts[1]["severity"] == "warning"


# ---- contractor manager ----

@pytest.mark.django_db
def test_contractor_gets_score_unverified_and_pending_alerts(contractor, technician):
    contractor.verification_status = ContractorVerificationStatus.PENDING
    contractor.save(update_fields=["verification_status"])
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.LEAK_DETECTION, status=CapabilityStatus.PENDING,
    )

    alerts = {a["id"]: a for a in compute_alerts(contractor.manager)}

    assert alerts[f"company:{contractor.id}:unverified"]["severity"] == "info"
    assert alerts[f"company:{contractor.id}:score"]["severity"] == "warning"
    assert "1 capability waiting" in alerts[f"company:{contractor.id}:pending"]["title"]


@pytest.mark.django_db
def test_contractor_alerted_about_roster_credential_by_technician_name(contractor, technician):
    expiring = credential(technician, 7)

    alerts = compute_alerts(contractor.manager)

    alert = next(a for a in alerts if a["id"] == f"roster{technician.id}:expiring:{expiring.id}")
    assert technician.user.email in alert["title"]


@pytest.mark.django_db
def test_contractor_alerted_about_nearly_empty_supply_cylinder_only(contractor, refrigerants):
    low = RefrigerantCylinder.objects.create(
        company=contractor, serial_number="LOW-1", refrigerant_type=refrigerants["R-134a"],
        kind=RefrigerantCylinder.Kind.SUPPLY, capacity_kg=Decimal("20"), current_kg=Decimal("1.5"),
    )
    RefrigerantCylinder.objects.create(
        company=contractor, serial_number="REC-FULLISH", refrigerant_type=refrigerants["R-134a"],
        kind=RefrigerantCylinder.Kind.RECOVERY, capacity_kg=Decimal("20"), current_kg=Decimal("1"),
    )
    RefrigerantCylinder.objects.create(
        company=contractor, serial_number="OK-1", refrigerant_type=refrigerants["R-134a"],
        kind=RefrigerantCylinder.Kind.SUPPLY, capacity_kg=Decimal("20"), current_kg=Decimal("15"),
    )

    cylinder_alerts = [a for a in compute_alerts(contractor.manager) if a["category"] == "cylinder"]

    assert [a["id"] for a in cylinder_alerts] == [f"cylinder:{low.id}:low"]


# ---- admin ----

@pytest.mark.django_db
def test_admin_sees_review_queues_with_correct_plurals(admin_user, technician):
    credential(technician, 400, status=CredentialStatus.PENDING, name="One")

    titles = [a["title"] for a in compute_alerts(admin_user)]
    assert "1 credential awaiting review" in titles

    credential(technician, 400, status=CredentialStatus.PENDING, name="Two")
    titles = [a["title"] for a in compute_alerts(admin_user)]
    assert "2 credentials awaiting review" in titles


@pytest.mark.django_db
def test_admin_gets_critical_alert_when_audit_chain_is_broken(admin_user, facility):
    entry = AuditLog.record(admin_user, "facility.create", facility)
    AuditLog.record(admin_user, "facility.update", facility)
    AuditLog.objects.filter(pk=entry.pk).update(action="facility.delete")

    alert = next(a for a in compute_alerts(admin_user) if a["id"] == "audit:broken")

    assert alert["severity"] == "critical"
    assert f"#{entry.id}" in alert["detail"]


@pytest.mark.django_db
def test_admin_has_no_audit_alert_when_chain_is_intact(admin_user, facility):
    AuditLog.record(admin_user, "facility.create", facility)
    assert "audit:broken" not in ids(compute_alerts(admin_user))


# ---- endpoint ----

@pytest.mark.django_db
def test_alerts_endpoint_requires_login(api_client):
    assert api_client.get("/api/alerts/").status_code == 401


@pytest.mark.django_db
def test_alerts_endpoint_returns_only_the_callers_alerts(api_client, technician):
    credential(technician, -1)
    api_client.force_authenticate(user=technician.user)

    response = api_client.get("/api/alerts/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["severity"] == "critical"


# ---- email digest ----

@pytest.mark.django_db
def test_digest_emails_only_users_with_actionable_alerts(technician, contractor, facility_manager, admin_user):
    credential(technician, -2)  # critical for the technician AND for their contractor manager
    # facility_manager has nothing; admin has only info-level queue items
    credential(technician, 400, status=CredentialStatus.PENDING, name="Queued")

    from apps.core.services.alerts import send_alert_digests

    sent = send_alert_digests()

    recipients = {m.to[0] for m in mail.outbox}
    assert sent == 2
    assert recipients == {technician.user.email, contractor.manager.email}
    technician_mail = next(m for m in mail.outbox if m.to == [technician.user.email])
    assert "EPA 608 has expired" in technician_mail.body


@pytest.mark.django_db
def test_digest_endpoint_needs_the_cron_token(api_client, settings, technician):
    credential(technician, -2)
    settings.ALERTS_CRON_TOKEN = "s3cret"

    assert api_client.post("/api/alerts/send-digest/").status_code == 403
    assert api_client.post("/api/alerts/send-digest/", HTTP_X_CRON_TOKEN="wrong").status_code == 403

    response = api_client.post("/api/alerts/send-digest/", HTTP_X_CRON_TOKEN="s3cret")
    assert response.status_code == 200
    # the technician and their contractor manager both have something actionable
    assert response.data == {"emails_sent": 2}


@pytest.mark.django_db
def test_digest_endpoint_is_disabled_when_no_token_is_configured(api_client, settings):
    settings.ALERTS_CRON_TOKEN = ""
    response = api_client.post("/api/alerts/send-digest/", HTTP_X_CRON_TOKEN="")
    assert response.status_code == 403
