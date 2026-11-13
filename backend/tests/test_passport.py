import uuid

import pytest

from apps.core.choices import CapabilityStatus, CapabilityType, CredentialStatus, SafetyDomain
from apps.technicians.models import CapabilitySkill, Credential
from apps.technicians.services.passport import passport_digest


def verified_capability(technician, domain=SafetyDomain.AMMONIA_SAFETY):
    return CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=domain, status=CapabilityStatus.VERIFIED,
    )


@pytest.mark.django_db
def test_passport_pdf_is_a_real_pdf_and_needs_no_auth(api_client, technician):
    verified_capability(technician)

    response = api_client.get(f"/api/public/technicians/{technician.public_token}/passport.pdf")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert "attachment" in response["Content-Disposition"]


@pytest.mark.django_db
def test_passport_pdf_for_technician_with_nothing_verified_still_renders(api_client, technician):
    response = api_client.get(f"/api/public/technicians/{technician.public_token}/passport.pdf")

    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")


@pytest.mark.django_db
def test_passport_pdf_unknown_token_is_404(api_client):
    response = api_client.get(f"/api/public/technicians/{uuid.uuid4()}/passport.pdf")
    assert response.status_code == 404


@pytest.mark.django_db
def test_digest_is_stable_across_calls(technician):
    verified_capability(technician)
    assert passport_digest(technician) == passport_digest(technician)


@pytest.mark.django_db
def test_digest_ignores_pending_items(technician):
    verified_capability(technician)
    before = passport_digest(technician)

    CapabilitySkill.objects.create(
        technician=technician, capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.LEAK_DETECTION, status=CapabilityStatus.PENDING,
    )
    Credential.objects.create(
        technician=technician, name="Unverified", issuer_name="Someone",
        file="credentials/x.pdf", status=CredentialStatus.PENDING,
    )

    assert passport_digest(technician) == before


@pytest.mark.django_db
def test_digest_changes_when_a_verified_capability_is_added_or_revoked(technician):
    first = verified_capability(technician)
    original = passport_digest(technician)

    verified_capability(technician, SafetyDomain.A2L_SAFETY)
    with_two = passport_digest(technician)
    assert with_two != original

    first.status = CapabilityStatus.NOT_QUALIFIED
    first.save()
    assert passport_digest(technician) != with_two


@pytest.mark.django_db
def test_verify_endpoint_accepts_the_current_digest(api_client, technician):
    verified_capability(technician)
    digest = passport_digest(technician)

    response = api_client.get(
        f"/api/public/technicians/{technician.public_token}/passport/verify/", {"hash": digest}
    )

    assert response.status_code == 200
    assert response.data["valid"] is True


@pytest.mark.django_db
def test_verify_endpoint_flags_a_passport_that_is_now_outdated(api_client, technician):
    capability = verified_capability(technician)
    digest_when_printed = passport_digest(technician)

    capability.status = CapabilityStatus.NOT_QUALIFIED
    capability.save()

    response = api_client.get(
        f"/api/public/technicians/{technician.public_token}/passport/verify/", {"hash": digest_when_printed}
    )

    assert response.status_code == 200
    assert response.data["valid"] is False


@pytest.mark.django_db
def test_verify_endpoint_rejects_a_made_up_hash(api_client, technician):
    response = api_client.get(
        f"/api/public/technicians/{technician.public_token}/passport/verify/", {"hash": "0" * 64}
    )
    assert response.data["valid"] is False


@pytest.mark.django_db
def test_verify_endpoint_requires_a_hash(api_client, technician):
    response = api_client.get(f"/api/public/technicians/{technician.public_token}/passport/verify/")
    assert response.status_code == 400
