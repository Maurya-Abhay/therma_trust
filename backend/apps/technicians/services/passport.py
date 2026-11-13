"""Verifiable technician passport: the verified-only facts, a digest over
them, and a printable PDF that embeds that digest in its QR code.

The digest is what makes a *printed* passport checkable later: scanning the
QR re-computes it from live records, so a passport goes "outdated" the moment
a capability is revoked or a credential expires.
"""
import hashlib
import io
import json
from xml.sax.saxutils import escape

import qrcode
from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.choices import CapabilityStatus, CredentialStatus

BRAND = colors.HexColor("#157F79")
TYPE_ORDER = {"equipment": 0, "refrigerant": 1, "safety": 2}
TYPE_LABELS = {"equipment": "Equipment", "refrigerant": "Refrigerant", "safety": "Safety"}


def verified_facts(technician):
    """Only what the platform has verified — nothing pending, no contact details."""
    capabilities = [
        {"label": c.label(), "capability_type": c.capability_type, "verified_at": c.verified_at}
        for c in technician.capabilities.filter(status=CapabilityStatus.VERIFIED).select_related("refrigerant_type")
    ]
    credentials = [
        {"name": c.name, "issuer_name": c.issuer_name, "expiry_date": c.expiry_date}
        for c in technician.credentials.all()
        if c.effective_status == CredentialStatus.PLATFORM_VERIFIED
    ]
    return capabilities, credentials


def display_name(technician):
    return technician.user.get_full_name() or technician.user.email


def compute_digest(technician, capabilities, credentials):
    # Timestamps are left out on purpose: re-verifying the same capability
    # shouldn't invalidate a passport, only a real change in what's verified.
    canonical = {
        "token": str(technician.public_token),
        "name": display_name(technician),
        "contractor": technician.contractor.name if technician.contractor else None,
        "capabilities": sorted(f"{c['capability_type']}:{c['label']}" for c in capabilities),
        "credentials": sorted(
            f"{c['name']}|{c['issuer_name']}|{c['expiry_date'] or ''}" for c in credentials
        ),
    }
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def passport_digest(technician):
    capabilities, credentials = verified_facts(technician)
    return compute_digest(technician, capabilities, credentials)


def passport_verify_url(technician, digest):
    return f"{settings.FRONTEND_URL.rstrip('/')}/verify/{technician.public_token}?hash={digest}"


def _qr_image(url, size):
    buffer = io.BytesIO()
    qrcode.make(url).save(buffer, format="PNG")
    buffer.seek(0)
    return Image(buffer, width=size, height=size)


def _table(rows, header, col_widths):
    table = Table([header] + rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F8F8")]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D5E3E2")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def render_passport_pdf(technician):
    capabilities, credentials = verified_facts(technician)
    digest = compute_digest(technician, capabilities, credentials)

    styles = getSampleStyleSheet()
    brand = ParagraphStyle("brand", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, textColor=BRAND)
    title = ParagraphStyle("title", parent=styles["Title"], alignment=0, fontSize=22, spaceAfter=2)
    meta = ParagraphStyle("meta", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#555555"))
    heading = ParagraphStyle("heading", parent=styles["Heading3"], textColor=BRAND, spaceBefore=14, spaceAfter=6)
    empty = ParagraphStyle("empty", parent=styles["Normal"], textColor=colors.HexColor("#777777"), fontSize=9.5)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#555555"), leading=11)
    mono = ParagraphStyle("mono", parent=small, fontName="Courier", fontSize=7.5, leading=10)

    story = [
        Paragraph("ThermaTrust", brand),
        Paragraph("Verified Technician Passport", title),
        Paragraph(escape(display_name(technician)), ParagraphStyle("name", parent=title, fontSize=16, spaceAfter=4)),
    ]
    contractor_line = escape(technician.contractor.name) if technician.contractor else "Independent technician"
    story.append(Paragraph(f"{contractor_line} &nbsp;|&nbsp; Issued {timezone.now().date().isoformat()}", meta))
    story.append(
        Paragraph(f"Experience (self-reported): {technician.years_experience} years", meta)
    )

    story.append(Paragraph("Verified capabilities", heading))
    if capabilities:
        ordered = sorted(capabilities, key=lambda c: (TYPE_ORDER.get(c["capability_type"], 9), c["label"]))
        rows = [[TYPE_LABELS.get(c["capability_type"], c["capability_type"]), escape(c["label"])] for c in ordered]
        story.append(_table(rows, ["Type", "Capability"], [35 * mm, 135 * mm]))
    else:
        story.append(Paragraph("No platform-verified capabilities yet.", empty))

    story.append(Paragraph("Platform-verified credentials", heading))
    if credentials:
        rows = [
            [escape(c["name"]), escape(c["issuer_name"]), c["expiry_date"].isoformat() if c["expiry_date"] else "No expiry"]
            for c in credentials
        ]
        story.append(_table(rows, ["Credential", "Issuer", "Expires"], [70 * mm, 70 * mm, 30 * mm]))
    else:
        story.append(Paragraph("No platform-verified credentials yet.", empty))

    story.append(Spacer(1, 14 * mm))
    qr = _qr_image(passport_verify_url(technician, digest), 32 * mm)
    notes = [
        Paragraph("<b>Scan to check this passport is still current.</b>", small),
        Spacer(1, 2 * mm),
        Paragraph(
            "Only items the platform has verified are listed. If any capability is later revoked or a "
            "credential expires, scanning this code will report that the passport is outdated.",
            small,
        ),
        Spacer(1, 3 * mm),
        Paragraph("Integrity digest (SHA-256)", small),
        Paragraph(f"{digest[:32]}<br/>{digest[32:]}", mono),
    ]
    footer = Table([[qr, notes]], colWidths=[38 * mm, 132 * mm])
    footer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(footer)

    buffer = io.BytesIO()
    SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"ThermaTrust passport - {display_name(technician)}", author="ThermaTrust",
    ).build(story)
    return buffer.getvalue(), digest
