import uuid

import pytest

from apps.core.choices import CapabilityStatus, CapabilityType, CredentialStatus, SafetyDomain
from apps.technicians.models import CapabilitySkill, Credential


@pytest.mark.django_db
def test_public_verification_shows_only_verified_data(api_client, technician):
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.AMMONIA_SAFETY, status=CapabilityStatus.VERIFIED,
    )
    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.LEAK_DETECTION, status=CapabilityStatus.PENDING,
    )
    Credential.objects.create(
        technician=technician, name="EPA 608 Universal", issuer_name="EPA",
        file="credentials/test.pdf", status=CredentialStatus.PLATFORM_VERIFIED,
    )
    Credential.objects.create(
        technician=technician, name="Unverified Cert", issuer_name="Some Body",
        file="credentials/test2.pdf", status=CredentialStatus.PENDING,
    )

    response = api_client.get(f"/api/public/technicians/{technician.public_token}/")

    assert response.status_code == 200
    labels = [c["label"] for c in response.data["verified_capabilities"]]
    assert "Ammonia Safety" in labels
    assert "Leak Detection" not in labels
    names = [c["name"] for c in response.data["verified_credentials"]]
    assert "EPA 608 Universal" in names
    assert "Unverified Cert" not in names


@pytest.mark.django_db
def test_public_verification_requires_no_auth(api_client, technician):
    # api_client here is deliberately NOT authenticated
    response = api_client.get(f"/api/public/technicians/{technician.public_token}/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_public_verification_unknown_token_is_404(api_client):
    response = api_client.get(f"/api/public/technicians/{uuid.uuid4()}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_public_qr_returns_png(api_client, technician):
    response = api_client.get(f"/api/public/technicians/{technician.public_token}/qr/")
    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
