"""A printable equipment label: big QR code that opens the unit's service history."""
import io
from xml.sax.saxutils import escape

import qrcode
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND = colors.HexColor("#0F766E")


def equipment_url(equipment):
    return f"{settings.FRONTEND_URL.rstrip('/')}/equipment/{equipment.id}"


def render_equipment_label_pdf(equipment):
    buffer = io.BytesIO()
    qr_buffer = io.BytesIO()
    qrcode.make(equipment_url(equipment)).save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr = Image(qr_buffer, width=70 * mm, height=70 * mm)

    styles = getSampleStyleSheet()
    brand = ParagraphStyle("brand", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, textColor=BRAND)
    name = ParagraphStyle("name", parent=styles["Title"], alignment=0, fontSize=20, leading=24, spaceAfter=4)
    meta = ParagraphStyle("meta", parent=styles["Normal"], fontSize=10.5, textColor=colors.HexColor("#444444"), leading=15)
    hint = ParagraphStyle("hint", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#666666"), leading=12)

    details = [
        Paragraph("ThermaTrust", brand),
        Paragraph(escape(equipment.name), name),
        Paragraph(escape(equipment.facility.name), meta),
        Paragraph(f"Refrigerant: {escape(equipment.refrigerant_type.code)}", meta),
    ]
    if equipment.refrigerant_charge_kg:
        details.append(Paragraph(f"System charge: {equipment.refrigerant_charge_kg} kg", meta))
    details.append(Spacer(1, 4 * mm))
    details.append(Paragraph("Scan for service history, leak rate and open jobs.", hint))

    label = Table([[qr, details]], colWidths=[78 * mm, 92 * mm])
    label.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1.2, BRAND),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    SimpleDocTemplate(
        buffer, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm,
        title=f"ThermaTrust equipment label - {equipment.name}", author="ThermaTrust",
    ).build([label])
    return buffer.getvalue()
