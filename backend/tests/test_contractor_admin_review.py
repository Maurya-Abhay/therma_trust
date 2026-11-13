import pytest

from apps.contractors.models import ContractorDocument
from apps.core.choices import ContractorVerificationStatus


@pytest.mark.django_db
def test_admin_can_verify_contractor_company(api_client, admin_user, contractor):
    contractor.verification_status = ContractorVerificationStatus.PENDING
    contractor.save(update_fields=["verification_status"])
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        f"/api/contractors/{contractor.id}/verify/", {"verification_status": ContractorVerificationStatus.VERIFIED}
    )

    assert response.status_code == 200
    contractor.refresh_from_db()
    assert contractor.verification_status == ContractorVerificationStatus.VERIFIED


@pytest.mark.django_db
def test_contractor_manager_cannot_verify_own_company(api_client, contractor):
    api_client.force_authenticate(user=contractor.manager)

    response = api_client.post(
        f"/api/contractors/{contractor.id}/verify/", {"verification_status": ContractorVerificationStatus.VERIFIED}
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_verify_contractor_document(api_client, admin_user, contractor):
    document = ContractorDocument.objects.create(
        company=contractor, doc_type=ContractorDocument.DocType.INSURANCE,
        file="contractor_documents/test.pdf", status=ContractorDocument.Status.PENDING,
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        f"/api/contractor-documents/{document.id}/verify/", {"status": ContractorDocument.Status.VERIFIED}
    )

    assert response.status_code == 200
    document.refresh_from_db()
    assert document.status == ContractorDocument.Status.VERIFIED


@pytest.mark.django_db
def test_non_admin_cannot_verify_contractor_document(api_client, facility_manager, contractor):
    document = ContractorDocument.objects.create(
        company=contractor, doc_type=ContractorDocument.DocType.INSURANCE,
        file="contractor_documents/test.pdf", status=ContractorDocument.Status.PENDING,
    )
    api_client.force_authenticate(user=facility_manager)

    response = api_client.post(
        f"/api/contractor-documents/{document.id}/verify/", {"status": ContractorDocument.Status.VERIFIED}
    )

    assert response.status_code == 403
