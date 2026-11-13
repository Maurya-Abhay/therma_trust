import { config } from "../config.js";
import { BRAND, GREY, createDocument, heading, mm, qrPng, table } from "../lib/pdf.js";
import * as C from "../lib/choices.js";
import { num } from "../lib/decimal.js";

export const TYPE_ORDER = { equipment: 0, refrigerant: 1, safety: 2 };
export const TYPE_LABELS = { equipment: "Equipment", refrigerant: "Refrigerant", safety: "Safety" };

const stamp = (date) => (date ? new Date(date).toISOString().slice(0, 16).replace("T", " ") : "");

// ---- equipment label -----------------------------------------------------------

export const equipmentUrl = (equipment) => `${config.frontendUrl}/equipment/${equipment._id}`;

/** A printable label: a big QR code that opens the unit's service history. */
export async function renderEquipmentLabel({ equipment, facility, refrigerant }) {
  const { doc, finish } = createDocument({ title: `ThermaTrust equipment label - ${equipment.name}` });
  const qr = await qrPng(equipmentUrl(equipment));
  const left = doc.page.margins.left;
  const top = doc.y;
  const boxWidth = mm(170);
  const boxHeight = mm(86);

  doc.lineWidth(1.2).strokeColor(BRAND).rect(left, top, boxWidth, boxHeight).stroke();
  doc.image(qr, left + mm(4), top + mm(8), { width: mm(70), height: mm(70) });

  const textX = left + mm(82);
  const textWidth = boxWidth - mm(86);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND).text("ThermaTrust", textX, top + mm(10), { width: textWidth });
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#000000").text(equipment.name, textX, doc.y + 4, { width: textWidth });
  doc.font("Helvetica").fontSize(10.5).fillColor("#444444");
  doc.text(facility.name, textX, doc.y + 4, { width: textWidth });
  doc.text(`Refrigerant: ${refrigerant.code}`, { width: textWidth });
  if (equipment.refrigerant_charge_kg) {
    doc.text(`System charge: ${num(equipment.refrigerant_charge_kg).toFixed(2)} kg`, { width: textWidth });
  }
  doc.moveDown(0.8).fontSize(9).fillColor("#666666").text("Scan for service history, leak rate and open jobs.", { width: textWidth });
  return finish();
}

// ---- service report ------------------------------------------------------------

export async function renderServiceReport({
  report, job, equipment, facility, technicianName, refrigerant, addedFrom, recoveredInto, approver,
}) {
  const { doc, finish } = createDocument({ title: `ThermaTrust service report - job ${job._id}` });
  const widths = [mm(52), mm(118)];
  const value = (v, fallback = "Not recorded") => (v === null || v === undefined || String(v).trim() === "" ? fallback : String(v));

  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND).text("ThermaTrust");
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#000000").text(`Service Report - Job #${job._id}`);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(GREY)
    .text(`${facility.name}  |  ${equipment.name}  |  Status: ${C.ReportStatus.label(report.status)}`);

  heading(doc, "Job");
  table(doc, {
    widths,
    boldFirstColumn: true,
    rows: [
      ["Facility", value(facility.name)],
      ["Equipment", value(`${equipment.name} (${C.EquipmentCategory.label(equipment.category)})`)],
      ["Technician", value(technicianName)],
      ["Submitted", value(stamp(report.created_at))],
      ["Risk level", value(job.risk_level ? C.RiskLevel.label(job.risk_level) : "")],
    ],
  });

  heading(doc, "Findings");
  const readings = report.diagnostic_readings || {};
  const readingsText = Object.entries(readings)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
    .join(", ");
  table(doc, {
    widths,
    boldFirstColumn: true,
    rows: [
      ["Fault", value(report.fault_description)],
      ["Diagnostic readings", value(readingsText)],
      ["Parts replaced", value(report.parts_replaced, "None")],
      ["Leak test", value(report.leak_test_result)],
      ["Vacuum test", value(report.vacuum_result)],
      ["Summary", value(report.summary)],
    ],
  });

  heading(doc, "Refrigerant");
  table(doc, {
    widths,
    boldFirstColumn: true,
    rows: [
      ["Refrigerant", value(refrigerant.code)],
      ["Added", `${num(report.refrigerant_added_kg).toFixed(2)} kg (from ${addedFrom?.serial_number ?? "Not linked to a cylinder"})`],
      [
        "Recovered",
        `${num(report.refrigerant_recovered_kg).toFixed(2)} kg (into ${recoveredInto?.serial_number ?? "Not linked to a cylinder"})`,
      ],
    ],
  });

  heading(doc, "Sign-off");
  const signed = report.technician_signed_at ? stamp(report.technician_signed_at) : "Not signed";
  let reviewed = "Not yet reviewed";
  if (report.facility_approved_at) {
    reviewed = `${C.ReportStatus.label(report.status)} by ${approver ?? "Facility"} on ${stamp(report.facility_approved_at)}`;
  }
  table(doc, { widths, boldFirstColumn: true, rows: [["Technician signed", signed], ["Facility review", reviewed]] });

  doc.moveDown(1.5).font("Helvetica").fontSize(8).fillColor(GREY).text(
    `Generated by ThermaTrust on ${stamp(new Date())}. Refrigerant figures are as reported by the technician and are not independently lab-confirmed.`
  );
  return finish();
}

// ---- technician passport -------------------------------------------------------

export async function renderPassport({ displayName, contractorName, yearsExperience, capabilities, credentials, digest, verifyUrl }) {
  const { doc, finish } = createDocument({ title: `ThermaTrust passport - ${displayName}` });

  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND).text("ThermaTrust");
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#000000").text("Verified Technician Passport");
  doc.font("Helvetica-Bold").fontSize(16).text(displayName);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(GREY)
    .text(`${contractorName || "Independent technician"}  |  Issued ${new Date().toISOString().slice(0, 10)}`)
    .text(`Experience (self-reported): ${yearsExperience} years`);

  heading(doc, "Verified capabilities");
  if (capabilities.length) {
    const ordered = [...capabilities].sort(
      (a, b) =>
        (TYPE_ORDER[a.capability_type] ?? 9) - (TYPE_ORDER[b.capability_type] ?? 9) || a.label.localeCompare(b.label)
    );
    table(doc, {
      header: ["Type", "Capability"],
      widths: [mm(35), mm(135)],
      rows: ordered.map((c) => [TYPE_LABELS[c.capability_type] ?? c.capability_type, c.label]),
    });
  } else {
    doc.font("Helvetica").fontSize(9.5).fillColor("#777777").text("No platform-verified capabilities yet.");
  }

  heading(doc, "Platform-verified credentials");
  if (credentials.length) {
    table(doc, {
      header: ["Credential", "Issuer", "Expires"],
      widths: [mm(70), mm(70), mm(30)],
      rows: credentials.map((c) => [c.name, c.issuer_name, c.expiry_date || "No expiry"]),
    });
  } else {
    doc.font("Helvetica").fontSize(9.5).fillColor("#777777").text("No platform-verified credentials yet.");
  }

  doc.moveDown(2);
  const qr = await qrPng(verifyUrl);
  if (doc.y + mm(40) > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const top = doc.y;
  const left = doc.page.margins.left;
  doc.image(qr, left, top, { width: mm(32), height: mm(32) });
  const textX = left + mm(38);
  const textWidth = mm(132);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(GREY).text("Scan to check this passport is still current.", textX, top, { width: textWidth });
  doc
    .font("Helvetica")
    .text(
      "Only items the platform has verified are listed. If any capability is later revoked or a credential expires, scanning this code will report that the passport is outdated.",
      textX,
      doc.y + 3,
      { width: textWidth }
    );
  doc.text("Integrity digest (SHA-256)", textX, doc.y + 6, { width: textWidth });
  doc.font("Courier").fontSize(7.5).text(`${digest.slice(0, 32)}\n${digest.slice(32)}`, textX, doc.y + 2, { width: textWidth });
  return finish();
}
