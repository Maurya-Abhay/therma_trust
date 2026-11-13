import pytest

from apps.core.choices import CapabilityStatus, CapabilityType, CredentialStatus, SafetyDomain
from apps.technicians.models import CapabilitySkill, Credential


@pytest.mark.django_db
def test_admin_dashboard_reachable_by_admin(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get("/api/admin/dashboard/")
    assert response.status_code == 200
    assert "pending_credentials" in response.data
    assert "recent_audit_log" in response.data


@pytest.mark.django_db
def test_admin_dashboard_blocked_for_non_admin(api_client, facility_manager):
    api_client.force_authenticate(user=facility_manager)
    response = api_client.get("/api/admin/dashboard/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_dashboard_counts_pending_items(api_client, admin_user, technician):
    Credential.objects.create(
        technician=technician, name="Cert", issuer_name="EPA",
        file="credentials/test.pdf", status=CredentialStatus.PENDING,
    )
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.AMMONIA_SAFETY, status=CapabilityStatus.PENDING,
    )

    api_client.force_authenticate(user=admin_user)
    response = api_client.get("/api/admin/dashboard/")

    assert response.data["pending_credentials"] >= 1
    assert response.data["pending_capabilities"] >= 1


@pytest.mark.django_db
def test_contractor_pending_approvals_count(api_client, contractor, technician):
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.LEAK_DETECTION, status=CapabilityStatus.PENDING,
    )
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.AMMONIA_SAFETY, status=CapabilityStatus.VERIFIED,
    )

    api_client.force_authenticate(user=contractor.manager)
    response = api_client.get(f"/api/contractors/{contractor.id}/pending-approvals/")

    assert response.status_code == 200
    assert response.data["pending_capabilities"] == 1
