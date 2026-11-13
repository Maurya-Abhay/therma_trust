import datetime

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.core.choices import CredentialStatus
from apps.technicians.models import Credential


@pytest.mark.django_db
def test_platform_verified_credential_past_expiry_reports_expired(technician):
    credential = Credential.objects.create(
        technician=technician, name="Old Cert", issuer_name="Issuer",
        expiry_date=timezone.now().date() - datetime.timedelta(days=1),
        file="credentials/test.pdf", status=CredentialStatus.PLATFORM_VERIFIED,
    )
    assert credential.effective_status == CredentialStatus.EXPIRED


@pytest.mark.django_db
def test_platform_verified_credential_future_expiry_stays_verified(technician):
    credential = Credential.objects.create(
        technician=technician, name="Fresh Cert", issuer_name="Issuer",
        expiry_date=timezone.now().date() + datetime.timedelta(days=365),
        file="credentials/test.pdf", status=CredentialStatus.PLATFORM_VERIFIED,
    )
    assert credential.effective_status == CredentialStatus.PLATFORM_VERIFIED


@pytest.mark.django_db
def test_pending_credential_past_expiry_is_not_reported_expired(technician):
    """effective_status only auto-expires credentials that were actually verified."""
    credential = Credential.objects.create(
        technician=technician, name="Never Verified", issuer_name="Issuer",
        expiry_date=timezone.now().date() - datetime.timedelta(days=1),
        file="credentials/test.pdf", status=CredentialStatus.PENDING,
    )
    assert credential.effective_status == CredentialStatus.PENDING


@pytest.mark.django_db
def test_technician_can_submit_own_credential_via_api(api_client, technician):
    api_client.force_authenticate(user=technician.user)
    dummy_file = SimpleUploadedFile("cert.pdf", b"dummy content", content_type="application/pdf")
    response = api_client.post(
        "/api/credentials/",
        {"technician": technician.id, "name": "EPA 608", "issuer_name": "EPA", "credential_number": "123", "file": dummy_file},
        format="multipart",
    )
    assert response.status_code == 201, response.data
    assert response.data["technician"] == technician.id
    assert response.data["status"] == CredentialStatus.PENDING


@pytest.mark.django_db
def test_admin_can_verify_credential(api_client, admin_user, technician):
    credential = Credential.objects.create(
        technician=technician, name="EPA 608", issuer_name="EPA",
        file="credentials/test.pdf", status=CredentialStatus.PENDING,
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        f"/api/credentials/{credential.id}/verify/", {"status": CredentialStatus.PLATFORM_VERIFIED}
    )

    assert response.status_code == 200
    credential.refresh_from_db()
    assert credential.status == CredentialStatus.PLATFORM_VERIFIED
    assert credential.reviewed_by == admin_user
    assert credential.reviewed_at is not None


@pytest.mark.django_db
def test_non_admin_cannot_verify_credential(api_client, facility_manager, technician):
    credential = Credential.objects.create(
        technician=technician, name="EPA 608", issuer_name="EPA",
        file="credentials/test.pdf", status=CredentialStatus.PENDING,
    )
    api_client.force_authenticate(user=facility_manager)

    response = api_client.post(
        f"/api/credentials/{credential.id}/verify/", {"status": CredentialStatus.PLATFORM_VERIFIED}
    )

    assert response.status_code == 403
    credential.refresh_from_db()
    assert credential.status == CredentialStatus.PENDING


@pytest.mark.django_db
def test_verify_rejects_invalid_status(api_client, admin_user, technician):
    credential = Credential.objects.create(
        technician=technician, name="EPA 608", issuer_name="EPA",
        file="credentials/test.pdf", status=CredentialStatus.PENDING,
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(f"/api/credentials/{credential.id}/verify/", {"status": "not_a_real_status"})

    assert response.status_code == 400


@pytest.mark.django_db
def test_technician_cannot_submit_credential_for_another_technician(api_client, technician, contractor):
    from apps.accounts.models import User
    from apps.technicians.models import TechnicianProfile

    other_user = User.objects.create_user(
        username="other_tech", email="other_tech@test.local", password="pass12345", role=User.Role.TECHNICIAN
    )
    other_technician = TechnicianProfile.objects.create(user=other_user, contractor=contractor)

    api_client.force_authenticate(user=technician.user)
    dummy_file = SimpleUploadedFile("cert.pdf", b"dummy content", content_type="application/pdf")
    response = api_client.post(
        "/api/credentials/",
        {"technician": other_technician.id, "name": "EPA 608", "issuer_name": "EPA", "file": dummy_file},
        format="multipart",
    )
    assert response.status_code == 403
