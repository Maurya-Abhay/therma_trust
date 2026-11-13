"""Printable service report: the record a facility or auditor keeps on file."""
import io
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND = colors.HexColor("#0F766E")


def _kv_table(rows):
    table = Table(rows, colWidths=[52 * mm, 118 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#444444")),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F3F8F8")]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D5E3E2")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _text(value, fallback="Not recorded"):
    value = (str(value).strip() if value is not None else "")
    return Paragraph(escape(value) if value else f"<font color='#888888'>{fallback}</font>", ParagraphStyle("c", fontSize=9.5, leading=12))


def render_service_report_pdf(report):
    job = report.job
    equipment = job.equipment
    technician_name = report.technician.user.get_full_name() or report.technician.user.email

    styles = getSampleStyleSheet()
    brand = ParagraphStyle("brand", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, textColor=BRAND)
    title = ParagraphStyle("title", parent=styles["Title"], alignment=0, fontSize=22, spaceAfter=2)
    meta = ParagraphStyle("meta", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#555555"))
    heading = ParagraphStyle("heading", parent=styles["Heading3"], textColor=BRAND, spaceBefore=14, spaceAfter=6)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#555555"), leading=11)

    story = [
        Paragraph("ThermaTrust", brand),
        Paragraph(f"Service Report - Job #{job.id}", title),
        Paragraph(
            f"{escape(job.facility.name)} &nbsp;|&nbsp; {escape(equipment.name)} &nbsp;|&nbsp; "
            f"Status: {escape(report.get_status_display())}",
            meta,
        ),
    ]

    story.append(Paragraph("Job", heading))
    story.append(
        _kv_table(
            [
                ["Facility", _text(job.facility.name)],
                ["Equipment", _text(f"{equipment.name} ({equipment.get_category_display()})")],
                ["Technician", _text(technician_name)],
                ["Submitted", _text(report.created_at.strftime("%Y-%m-%d %H:%M"))],
                ["Risk level", _text(job.get_risk_level_display() if job.risk_level else "")],
            ]
        )
    )

    story.append(Paragraph("Findings", heading))
    readings = report.diagnostic_readings or {}
    readings_text = ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in readings.items() if v not in (None, ""))
    story.append(
        _kv_table(
            [
                ["Fault", _text(report.fault_description)],
                ["Diagnostic readings", _text(readings_text)],
                ["Parts replaced", _text(report.parts_replaced, "None")],
                ["Leak test", _text(report.leak_test_result)],
                ["Vacuum test", _text(report.vacuum_result)],
                ["Summary", _text(report.summary)],
            ]
        )
    )

    story.append(Paragraph("Refrigerant", heading))
    added_from = report.added_from_cylinder.serial_number if report.added_from_cylinder else "Not linked to a cylinder"
    recovered_into = report.recovered_into_cylinder.serial_number if report.recovered_into_cylinder else "Not linked to a cylinder"
    story.append(
        _kv_table(
            [
                ["Refrigerant", _text(report.refrigerant_type.code)],
                ["Added", _text(f"{report.refrigerant_added_kg} kg (from {added_from})")],
                ["Recovered", _text(f"{report.refrigerant_recovered_kg} kg (into {recovered_into})")],
            ]
        )
    )

    story.append(Paragraph("Sign-off", heading))
    signed = report.technician_signed_at.strftime("%Y-%m-%d %H:%M") if report.technician_signed_at else "Not signed"
    approved = "Not yet reviewed"
    if report.facility_approved_at:
        who = report.facility_approved_by.get_full_name() or report.facility_approved_by.email if report.facility_approved_by else "Facility"
        approved = f"{report.get_status_display()} by {who} on {report.facility_approved_at.strftime('%Y-%m-%d %H:%M')}"
    story.append(_kv_table([["Technician signed", _text(signed)], ["Facility review", _text(approved)]]))

    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            f"Generated by ThermaTrust on {timezone.now().strftime('%Y-%m-%d %H:%M')}. "
            "Refrigerant figures are as reported by the technician and are not independently lab-confirmed.",
            small,
        )
    )

    buffer = io.BytesIO()
    SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"ThermaTrust service report - job {job.id}", author="ThermaTrust",
    ).build(story)
    return buffer.getvalue()
