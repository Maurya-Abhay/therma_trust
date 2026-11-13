import datetime
from types import SimpleNamespace

import anthropic
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.choices import CredentialStatus
from apps.core.models import AuditLog
from apps.technicians.models import Credential
from apps.technicians.services import credential_ocr
from apps.technicians.services.credential_ocr import ExtractedCredential, compare_extraction

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
PDF = b"%PDF-1.4\n" + b"\x00" * 32
TODAY = datetime.date(2026, 10, 9)


def extracted(**overrides):
    base = dict(
        is_credential_document=True, holder_name="Priya Midlevel", credential_name="EPA Section 608 Type II",
        issuer_name="US Environmental Protection Agency", credential_number="608-12345",
        issue_date="2025-01-10", expiry_date="2030-01-10", notes=None,
    )
    base.update(overrides)
    return ExtractedCredential(**base)


def credential_row(technician, **overrides):
    fields = dict(
        technician=technician, name="EPA 608", issuer_name="EPA", credential_number="608-12345",
        expiry_date=datetime.date(2030, 1, 10), file=SimpleUploadedFile("c.png", PNG), status=CredentialStatus.PENDING,
    )
    fields.update(overrides)
    return Credential.objects.create(**fields)


def codes(flags):
    return {f["code"] for f in flags}


# ---- comparison rules (pure logic) ----

@pytest.mark.django_db
def test_matching_document_has_no_flags(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    assert compare_extraction(extracted(), credential_row(technician), "Priya Midlevel", TODAY) == []


@pytest.mark.django_db
def test_different_person_is_flagged_but_a_middle_name_is_not(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician)

    assert "holder_name_mismatch" in codes(compare_extraction(extracted(holder_name="Rahul Sharma"), row, "Priya Midlevel", TODAY))
    assert compare_extraction(extracted(holder_name="Priya Anne Midlevel"), row, "Priya Midlevel", TODAY) == []
    assert compare_extraction(extracted(holder_name="PRIYA MIDLEVEL"), row, "priya midlevel", TODAY) == []


@pytest.mark.django_db
def test_expiry_and_number_mismatches_are_flagged(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician)

    flags = compare_extraction(extracted(expiry_date="2031-06-01", credential_number="999-00000"), row, "Priya Midlevel", TODAY)

    assert codes(flags) == {"expiry_mismatch", "number_mismatch"}


@pytest.mark.django_db
def test_number_formatting_differences_are_not_mismatches(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician, credential_number="608 12345")
    assert compare_extraction(extracted(credential_number="608-12345"), row, "Priya Midlevel", TODAY) == []


@pytest.mark.django_db
def test_document_that_is_itself_expired_is_flagged(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician, expiry_date=datetime.date(2020, 1, 1))

    flags = compare_extraction(extracted(expiry_date="2020-01-01"), row, "Priya Midlevel", TODAY)

    assert codes(flags) == {"document_expired"}


@pytest.mark.django_db
def test_issuer_mismatch_is_info_level(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician, issuer_name="Local Trade School")

    flags = compare_extraction(extracted(), row, "Priya Midlevel", TODAY)

    assert [(f["code"], f["severity"]) for f in flags] == [("issuer_mismatch", "info")]


@pytest.mark.django_db
def test_non_credential_and_unreadable_documents(technician, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician)

    assert codes(compare_extraction(extracted(is_credential_document=False), row, "Priya", TODAY)) == {"not_a_credential"}
    assert codes(compare_extraction(extracted(holder_name=None), row, "Priya Midlevel", TODAY)) == {"unreadable_name"}
    assert compare_extraction(extracted(expiry_date="not a date"), row, "Priya Midlevel", TODAY) == []


# ---- file sniffing ----

def test_media_type_comes_from_the_bytes_not_the_filename():
    assert credential_ocr.detect_media_type(PNG) == "image/png"
    assert credential_ocr.detect_media_type(PDF) == "application/pdf"
    assert credential_ocr.detect_media_type(b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert credential_ocr.detect_media_type(b"RIFF\x00\x00\x00\x00WEBPrest") == "image/webp"
    assert credential_ocr.detect_media_type(b"just some text") is None


# ---- the model call (SDK faked) ----

class FakeAnthropic:
    last = None

    def __init__(self, **kwargs):
        FakeAnthropic.client_kwargs = kwargs
        self.messages = SimpleNamespace(parse=self._parse)
        self.result = extracted()

    def _parse(self, **kwargs):
        FakeAnthropic.last = kwargs
        if isinstance(self.result, Exception):
            raise self.result
        return SimpleNamespace(parsed_output=self.result)


@pytest.fixture
def fake_sdk(monkeypatch, settings):
    settings.ANTHROPIC_API_KEY = "test-key"
    settings.CREDENTIAL_OCR_MODEL = "claude-opus-5-5"
    monkeypatch.setattr(anthropic, "Anthropic", FakeAnthropic)
    FakeAnthropic.last = None
    return FakeAnthropic


def test_without_an_api_key_the_feature_is_unavailable(settings):
    settings.ANTHROPIC_API_KEY = ""
    with pytest.raises(credential_ocr.OcrUnavailable):
        credential_ocr.extract_credential_fields(PNG, "image/png")


def test_images_are_sent_as_image_blocks_with_a_structured_schema(fake_sdk):
    result = credential_ocr.extract_credential_fields(PNG, "image/png")

    request = fake_sdk.last
    assert result.holder_name == "Priya Midlevel"
    assert request["model"] == "claude-opus-5-5"
    assert request["output_format"] is ExtractedCredential
    assert request["output_config"] == {"effort": "low"}
    block = request["messages"][0]["content"][0]
    assert block["type"] == "image" and block["source"]["media_type"] == "image/png"
    assert fake_sdk.client_kwargs["api_key"] == "test-key"


def test_pdfs_are_sent_as_document_blocks(fake_sdk):
    credential_ocr.extract_credential_fields(PDF, "application/pdf")
    assert fake_sdk.last["messages"][0]["content"][0]["type"] == "document"


def test_api_errors_become_ocr_failed(fake_sdk, monkeypatch):
    def boom(self, **kwargs):
        raise anthropic.APIError.__new__(anthropic.APIError)

    monkeypatch.setattr(FakeAnthropic, "_parse", boom)
    with pytest.raises(credential_ocr.OcrFailed):
        credential_ocr.extract_credential_fields(PNG, "image/png")


def test_an_empty_parse_result_becomes_ocr_failed(fake_sdk, monkeypatch):
    monkeypatch.setattr(FakeAnthropic, "_parse", lambda self, **kw: SimpleNamespace(parsed_output=None))
    with pytest.raises(credential_ocr.OcrFailed):
        credential_ocr.extract_credential_fields(PNG, "image/png")


# ---- /api/credentials/extract/ (technician pre-fill) ----

@pytest.fixture
def stub_extraction(monkeypatch):
    monkeypatch.setattr(credential_ocr, "extract_credential_fields", lambda data, media_type: extracted())


@pytest.mark.django_db
def test_technician_can_scan_a_document_to_prefill_the_form(api_client, technician, stub_extraction):
    api_client.force_authenticate(user=technician.user)

    response = api_client.post("/api/credentials/extract/", {"file": SimpleUploadedFile("c.png", PNG)}, format="multipart")

    assert response.status_code == 200, response.data
    assert response.data["credential_number"] == "608-12345"
    assert not Credential.objects.exists()  # scanning saves nothing


@pytest.mark.django_db
def test_extract_rejects_unsupported_files_and_missing_files(api_client, technician, stub_extraction):
    api_client.force_authenticate(user=technician.user)

    text = api_client.post("/api/credentials/extract/", {"file": SimpleUploadedFile("c.txt", b"hello")}, format="multipart")
    missing = api_client.post("/api/credentials/extract/", {}, format="multipart")

    assert text.status_code == 400
    assert missing.status_code == 400


@pytest.mark.django_db
def test_extract_rejects_oversized_files(api_client, technician, stub_extraction, monkeypatch):
    monkeypatch.setattr(credential_ocr, "MAX_UPLOAD_BYTES", 10)
    api_client.force_authenticate(user=technician.user)

    response = api_client.post("/api/credentials/extract/", {"file": SimpleUploadedFile("c.png", PNG)}, format="multipart")

    assert response.status_code == 400
    assert "too large" in response.data["detail"]


@pytest.mark.django_db
def test_extract_reports_503_when_not_configured(api_client, technician, settings):
    settings.ANTHROPIC_API_KEY = ""
    api_client.force_authenticate(user=technician.user)

    response = api_client.post("/api/credentials/extract/", {"file": SimpleUploadedFile("c.png", PNG)}, format="multipart")

    assert response.status_code == 503


@pytest.mark.django_db
def test_extract_reports_502_when_the_model_call_fails(api_client, technician, monkeypatch):
    def fail(data, media_type):
        raise credential_ocr.OcrFailed("The document reader is temporarily unavailable.")

    monkeypatch.setattr(credential_ocr, "extract_credential_fields", fail)
    api_client.force_authenticate(user=technician.user)

    response = api_client.post("/api/credentials/extract/", {"file": SimpleUploadedFile("c.png", PNG)}, format="multipart")

    assert response.status_code == 502


@pytest.mark.django_db
def test_only_technicians_can_use_extract(api_client, facility_manager, stub_extraction):
    api_client.force_authenticate(user=facility_manager)
    response = api_client.post("/api/credentials/extract/", {"file": SimpleUploadedFile("c.png", PNG)}, format="multipart")
    assert response.status_code == 403


# ---- /api/credentials/{id}/ai-check/ (admin second opinion) ----

@pytest.mark.django_db
def test_admin_ai_check_stores_extraction_and_flags(api_client, admin_user, technician, stub_extraction, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    technician.user.first_name, technician.user.last_name = "Someone", "Else"
    technician.user.save()
    row = credential_row(technician)
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(f"/api/credentials/{row.id}/ai-check/")

    assert response.status_code == 200, response.data
    flags = {f["code"] for f in response.data["ai_check"]["flags"]}
    assert "holder_name_mismatch" in flags
    assert response.data["ai_check"]["extracted"]["holder_name"] == "Priya Midlevel"
    row.refresh_from_db()
    assert row.ai_check is not None
    assert AuditLog.objects.filter(action="credential.ai_check", object_id=str(row.id)).exists()


@pytest.mark.django_db
def test_ai_check_does_not_change_the_credentials_status(api_client, admin_user, technician, stub_extraction, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician)
    api_client.force_authenticate(user=admin_user)

    api_client.post(f"/api/credentials/{row.id}/ai-check/")

    row.refresh_from_db()
    assert row.status == CredentialStatus.PENDING


@pytest.mark.django_db
def test_non_admins_cannot_run_ai_check_or_see_its_result(api_client, admin_user, technician, stub_extraction, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician)

    api_client.force_authenticate(user=technician.user)
    assert api_client.post(f"/api/credentials/{row.id}/ai-check/").status_code == 403

    api_client.force_authenticate(user=admin_user)
    api_client.post(f"/api/credentials/{row.id}/ai-check/")

    api_client.force_authenticate(user=technician.user)
    own = api_client.get(f"/api/credentials/{row.id}/")
    assert "ai_check" not in own.data

    api_client.force_authenticate(user=admin_user)
    assert api_client.get(f"/api/credentials/{row.id}/").data["ai_check"] is not None


@pytest.mark.django_db
def test_ai_check_handles_a_missing_stored_file(api_client, admin_user, technician, stub_extraction, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    row = credential_row(technician, file="credentials/never-uploaded.pdf")
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(f"/api/credentials/{row.id}/ai-check/")

    assert response.status_code == 400
    assert "could not be read" in response.data["detail"]
