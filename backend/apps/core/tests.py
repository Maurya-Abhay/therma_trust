from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from .upload_validation import validate_document_upload


class UploadValidationTests(SimpleTestCase):
    def test_accepts_pdf_with_a_matching_signature(self):
        upload = SimpleUploadedFile(
            "credential.pdf",
            b"%PDF-1.7\n% test document",
            content_type="application/pdf",
        )
        validate_document_upload(upload)

    def test_rejects_a_renamed_non_pdf_file(self):
        upload = SimpleUploadedFile(
            "credential.pdf",
            b"<html><script>alert(1)</script></html>",
            content_type="application/pdf",
        )
        with self.assertRaises(ValidationError):
            validate_document_upload(upload)

    def test_rejects_a_mismatched_multipart_content_type(self):
        upload = SimpleUploadedFile(
            "credential.pdf",
            b"%PDF-1.7\n% test document",
            content_type="text/html",
        )
        with self.assertRaises(ValidationError):
            validate_document_upload(upload)
