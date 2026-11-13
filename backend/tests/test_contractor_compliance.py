import pytest

from apps.contractors.models import ContractorDocument
from apps.contractors.services.compliance import compute_compliance
from apps.core.choices import CapabilityStatus, CapabilityType, CredentialStatus, SafetyDomain
from apps.technicians.models import CapabilitySkill, Credential


@pytest.mark.django_db
def test_compliance_score_reflects_verified_ratio(technician, contractor):
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.AMMONIA_SAFETY, status=CapabilityStatus.VERIFIED,
    )
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.LEAK_DETECTION, status=CapabilityStatus.PENDING,
    )
    Credential.objects.create(
        technician=technician, name="EPA 608", issuer_name="EPA",
        file="credentials/test.pdf", status=CredentialStatus.PLATFORM_VERIFIED,
    )

    result = compute_compliance(contractor)

    assert result["technician_count"] == 1
    assert result["capability_verified_rate"] == 50  # 1 of 2 verified
    assert result["credential_verified_rate"] == 100  # 1 of 1 verified
    assert result["company_verified"] is True
    assert 0 <= result["score"] <= 100


@pytest.mark.django_db
def test_compliance_score_zero_with_no_roster(contractor):
    result = compute_compliance(contractor)
    assert result["technician_count"] == 0
    assert result["score"] == 0


@pytest.mark.django_db
def test_compliance_endpoint_reachable_by_contractor_manager(api_client, contractor, technician):
    api_client.force_authenticate(user=contractor.manager)
    response = api_client.get(f"/api/contractors/{contractor.id}/compliance/")
    assert response.status_code == 200
    assert "score" in response.data
