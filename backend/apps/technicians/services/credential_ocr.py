"""AI-assisted reading of credential documents (EPA 608 cards, licences, ...).

Two separate jobs, deliberately kept apart:

* ``extract_credential_fields`` asks Claude to read the document into
  structured fields. It is a convenience for the technician (pre-fill) and a
  second opinion for the admin; it never approves anything.
* ``compare_extraction`` turns disagreements between what the document says and
  what the technician typed / who they are into reviewable flags. Plain code,
  no model involved, so the same inputs always give the same flags.
"""
import base64
import re
from datetime import date
from typing import Optional

from django.conf import settings
from pydantic import BaseModel, Field

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
PDF = "application/pdf"
IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

SYSTEM_PROMPT = (
    "You read photos and scans of professional credentials (certification cards, licences, "
    "training certificates) for a refrigeration compliance platform. Transcribe only what is "
    "printed on the document. Never guess or infer a value that is not visible: use null for "
    "anything missing or illegible and say so in `notes`. Dates must be ISO format YYYY-MM-DD. "
    "If the file is not a credential document at all, set is_credential_document to false."
)


class OcrUnavailable(Exception):
    """No API key configured (or SDK missing) - the feature is simply off."""


class OcrFailed(Exception):
    """The model call failed or returned nothing usable."""


class ExtractedCredential(BaseModel):
    is_credential_document: bool = Field(description="False if the file is not a certificate, licence or ID-style card")
    holder_name: Optional[str] = Field(description="Full name of the person the credential was issued to")
    credential_name: Optional[str] = Field(description="Title, e.g. 'EPA Section 608 Universal Certification'")
    issuer_name: Optional[str] = Field(description="Organisation that issued it")
    credential_number: Optional[str] = Field(description="Certificate / licence / card number")
    issue_date: Optional[str] = Field(description="Issue date as YYYY-MM-DD")
    expiry_date: Optional[str] = Field(description="Expiry date as YYYY-MM-DD, null if it does not expire")
    notes: Optional[str] = Field(description="Anything illegible, ambiguous or unusual about the document")


def detect_media_type(data):
    """Sniff the real type from magic bytes - the client-supplied content type is not trusted."""
    if data.startswith(b"%PDF"):
        return PDF
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def extract_credential_fields(data, media_type):
    if not settings.ANTHROPIC_API_KEY:
        raise OcrUnavailable("AI document reading isn't configured on this server.")

    import anthropic

    encoded = base64.standard_b64encode(data).decode("ascii")
    kind = "document" if media_type == PDF else "image"
    source_block = {"type": kind, "source": {"type": "base64", "media_type": media_type, "data": encoded}}

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)
    try:
        response = client.messages.parse(
            model=settings.CREDENTIAL_OCR_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            output_config={"effort": "low"},
            output_format=ExtractedCredential,
            messages=[{
                "role": "user",
                "content": [source_block, {"type": "text", "text": "Extract the credential details from this document."}],
            }],
        )
    except anthropic.APIError as exc:
        raise OcrFailed("The document reader is temporarily unavailable.") from exc

    extracted = response.parsed_output
    if extracted is None:
        # refusal, or the output was cut off before the JSON completed
        raise OcrFailed("The document reader couldn't produce a result for this file.")
    return extracted


# ---- comparison (no model involved) ----

def _tokens(text):
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))


def _alnum(text):
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper())


def _issuers_agree(typed, read):
    typed_words, read_words = re.findall(r"[a-z0-9]+", typed.lower()), re.findall(r"[a-z0-9]+", read.lower())
    if {w for w in typed_words if len(w) >= 3} & {w for w in read_words if len(w) >= 3}:
        return True
    # An acronym on one side and the full name on the other ("EPA" vs
    # "Environmental Protection Agency") is the normal way issuers get typed.
    typed_initials = "".join(w[0] for w in typed_words)
    read_initials = "".join(w[0] for w in read_words)
    return any(len(w) >= 3 and w in read_initials for w in typed_words) or any(
        len(w) >= 3 and w in typed_initials for w in read_words
    )


def _parse_date(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _flag(code, severity, message):
    return {"code": code, "severity": severity, "message": message}


def compare_extraction(extracted, credential, holder_name, today=None):
    """Flags where the document disagrees with the account or the typed-in fields."""
    today = today or date.today()
    flags = []

    if not extracted.is_credential_document:
        return [_flag("not_a_credential", "warning", "The uploaded file doesn't look like a credential document.")]

    if not extracted.holder_name:
        flags.append(_flag("unreadable_name", "info", "The holder's name couldn't be read from the document."))
    else:
        doc_tokens, account_tokens = _tokens(extracted.holder_name), _tokens(holder_name)
        shorter, longer = sorted((doc_tokens, account_tokens), key=len)
        # every word of the shorter name must appear in the longer one, which
        # tolerates a middle name or initial on one side but not a different person
        if not shorter or not shorter <= longer:
            flags.append(_flag(
                "holder_name_mismatch", "warning",
                f"The document is issued to '{extracted.holder_name}', but this account belongs to '{holder_name}'.",
            ))

    if credential.credential_number and extracted.credential_number:
        typed, read = _alnum(credential.credential_number), _alnum(extracted.credential_number)
        if typed and read and typed not in read and read not in typed:
            flags.append(_flag(
                "number_mismatch", "warning",
                f"Entered number '{credential.credential_number}' differs from '{extracted.credential_number}' on the document.",
            ))

    if credential.issuer_name and extracted.issuer_name and not _issuers_agree(
        credential.issuer_name, extracted.issuer_name
    ):
        flags.append(_flag(
            "issuer_mismatch", "info",
            f"Entered issuer '{credential.issuer_name}' differs from '{extracted.issuer_name}' on the document.",
        ))

    document_expiry = _parse_date(extracted.expiry_date)
    if document_expiry:
        if document_expiry < today:
            flags.append(_flag("document_expired", "warning", f"The document itself shows it expired on {document_expiry}."))
        if credential.expiry_date and credential.expiry_date != document_expiry:
            flags.append(_flag(
                "expiry_mismatch", "warning",
                f"Entered expiry {credential.expiry_date} differs from {document_expiry} on the document.",
            ))

    return flags
