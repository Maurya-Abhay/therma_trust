"""Shared upload checks used by document and image serializers.

These checks reduce accidental/unsafe file uploads; they are not a malware
scanner. Production deployments should also scan files and use private,
persistent object storage for identity and compliance documents.
"""
from pathlib import PurePath

from django.core.exceptions import ValidationError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
DOCUMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DOCUMENT_CONTENT_TYPES = {
    "application/pdf", "application/x-pdf", "image/png", "image/jpeg", "image/webp",
}
IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


def _validate_common(upload, *, extensions, content_types, label):
    if not upload:
        return
    if upload.size <= 0:
        raise ValidationError(f"The {label} file is empty.")
    if upload.size > MAX_UPLOAD_BYTES:
        raise ValidationError(f"The {label} file must be 10 MB or smaller.")

    extension = PurePath(upload.name or "").suffix.lower()
    if extension not in extensions:
        allowed = ", ".join(sorted(extensions))
        raise ValidationError(f"Unsupported {label} file type. Allowed extensions: {allowed}.")

    content_type = (getattr(upload, "content_type", "") or "").lower()
    if content_type and content_type not in content_types:
        raise ValidationError(f"The uploaded {label} MIME type is not supported.")

    # Extension and multipart MIME headers are client-controlled. Check the
    # file signature as well so a renamed executable/HTML file is not stored
    # as a compliance document.
    signatures = {
        ".pdf": lambda head: head.startswith(b"%PDF-"),
        ".png": lambda head: head.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": lambda head: head.startswith(b"\xff\xd8\xff"),
        ".jpeg": lambda head: head.startswith(b"\xff\xd8\xff"),
        ".webp": lambda head: head.startswith(b"RIFF") and head[8:12] == b"WEBP",
    }
    upload.seek(0)
    header = upload.read(16)
    upload.seek(0)
    if not signatures[extension](header):
        raise ValidationError(f"The uploaded {label} file content does not match its extension.")


def validate_document_upload(upload):
    """Allow common proof-document formats with a bounded payload size."""
    _validate_common(
        upload,
        extensions=DOCUMENT_EXTENSIONS,
        content_types=DOCUMENT_CONTENT_TYPES,
        label="document",
    )


def validate_image_upload(upload):
    """Allow only raster image uploads and verify that the bytes decode as an image."""
    _validate_common(
        upload,
        extensions=IMAGE_EXTENSIONS,
        content_types=IMAGE_CONTENT_TYPES,
        label="image",
    )
    if not upload:
        return

    from PIL import Image, UnidentifiedImageError

    try:
        upload.seek(0)
        with Image.open(upload) as image:
            if image.format not in {"PNG", "JPEG", "WEBP"}:
                raise ValidationError("Only PNG, JPEG and WebP images are supported.")
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError("The uploaded file is not a valid image.")
    finally:
        upload.seek(0)
