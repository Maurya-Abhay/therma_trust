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
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const issued = new Date().toISOString().slice(0, 10);
  const navy = "#102A43";
  const ink = "#183B56";
  const pale = "#F3F8F8";
  const line = "#D8E9E7";
  const green = "#0F766E";
  const ordered = [...capabilities].sort(
    (a, b) => (TYPE_ORDER[a.capability_type] ?? 9) - (TYPE_ORDER[b.capability_type] ?? 9) || a.label.localeCompare(b.label)
  );
  const innerTop = doc.page.margins.top;
  const innerHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const columnGap = mm(7);
  const columnWidth = (width - columnGap) / 2;
  const qr = await qrPng(verifyUrl);

  doc.lineWidth(1.3).strokeColor(green).roundedRect(left - mm(5), innerTop - mm(5), width + mm(10), innerHeight + mm(10), 8).stroke();
  doc.lineWidth(0.35).strokeColor(line).roundedRect(left - mm(2), innerTop - mm(2), width + mm(4), innerHeight + mm(4), 5).stroke();

  const headerTop = doc.y;
  doc.rect(left, headerTop, width, mm(27)).fill(navy);
  doc.rect(left, headerTop + mm(23), width, mm(4)).fill(green);
  doc.circle(left + mm(13), headerTop + mm(13.5), mm(7)).fill("#FFFFFF");
  doc.font("Helvetica-Bold").fontSize(9).fillColor(green).text("TT", left + mm(8), headerTop + mm(10.8), { width: mm(10), align: "center" });
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#FFFFFF").text("ThermaTrust", left + mm(25), headerTop + mm(5), { width: mm(90) });
  doc.font("Helvetica").fontSize(8).fillColor("#BEE8E3").text("TRUSTED REFRIGERATION PROFESSIONALS", left + mm(25), headerTop + mm(16), { width: mm(110) });
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF").text("TECHNICIAN PASSPORT", left + width - mm(58), headerTop + mm(10.5), { width: mm(50), align: "right" });
  doc.y = headerTop + mm(34);

  const identityTop = doc.y;
  doc.roundedRect(left, identityTop, width, mm(48), 7).fill(pale);
  doc.lineWidth(0.6).strokeColor(line).roundedRect(left, identityTop, width, mm(48), 7).stroke();
  const detailX = left + mm(8);
  const detailWidth = width - mm(64);
  doc.font("Helvetica").fontSize(8).fillColor(green).text("VERIFIED PROFESSIONAL", detailX, identityTop + mm(7), { width: detailWidth });
  doc.font("Helvetica-Bold").fontSize(21).fillColor(navy).text(displayName, detailX, identityTop + mm(14), { width: detailWidth });
  doc.font("Helvetica").fontSize(10).fillColor(ink).text(contractorName || "Independent technician", detailX, identityTop + mm(25), { width: detailWidth });
  doc.font("Helvetica").fontSize(8).fillColor(GREY).text(`Issued ${issued}  ·  ${yearsExperience} years experience (self-reported)`, detailX, identityTop + mm(34), { width: detailWidth });
  doc.roundedRect(left + width - mm(51), identityTop + mm(7), mm(41), mm(34), 6).fill("#FFFFFF");
  doc.image(qr, left + width - mm(48), identityTop + mm(10), { width: mm(35), height: mm(35) });
  doc.y = identityTop + mm(55);

  const statTop = doc.y;
  const statWidth = (width - mm(8)) / 3;
  [["EXPERIENCE", `${yearsExperience} years`, green], ["VERIFIED SKILLS", `${ordered.length}`, "#2D9CDB"], ["CREDENTIALS", `${credentials.length}`, "#D97706"]].forEach(([label, value, color], index) => {
    const x = left + index * (statWidth + mm(4));
    doc.roundedRect(x, statTop, statWidth, mm(19), 5).fill("#FFFFFF");
    doc.lineWidth(0.55).strokeColor(line).roundedRect(x, statTop, statWidth, mm(19), 5).stroke();
    doc.rect(x, statTop, mm(2), mm(19)).fill(color);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(navy).text(value, x + mm(7), statTop + mm(3.5), { width: statWidth - mm(10) });
    doc.font("Helvetica").fontSize(7).fillColor(GREY).text(label, x + mm(7), statTop + mm(12), { width: statWidth - mm(10) });
  });
  doc.y = statTop + mm(26);

  const sectionTitle = (x, y, title, count) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(green).text(title, x, y, { width: columnWidth - mm(20) });
    doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(count, x + columnWidth - mm(35), y + mm(0.5), { width: mm(35), align: "right" });
  };
  const capabilityTop = doc.y;
  sectionTitle(left, capabilityTop, "VERIFIED CAPABILITIES", `${ordered.length} items`);
  sectionTitle(left + columnWidth + columnGap, capabilityTop, "VERIFIED CREDENTIALS", `${credentials.length} records`);
  const contentTop = capabilityTop + mm(7);
  const pillWidth = columnWidth;
  const drawCapability = (item, index) => {
    const y = contentTop + index * mm(16);
    doc.roundedRect(left, y, pillWidth, mm(13), 5).fill(index % 2 ? "#FFFFFF" : pale);
    doc.lineWidth(0.45).strokeColor(line).roundedRect(left, y, pillWidth, mm(13), 5).stroke();
    doc.circle(left + mm(6), y + mm(6.5), mm(2)).fill(green);
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GREY).text((TYPE_LABELS[item.capability_type] ?? item.capability_type).toUpperCase(), left + mm(11), y + mm(2), { width: mm(38) });
    doc.font("Helvetica").fontSize(8.5).fillColor(ink).text(item.label, left + mm(11), y + mm(6), { width: pillWidth - mm(15), height: mm(5.5), ellipsis: true });
  };
  if (ordered.length) ordered.forEach(drawCapability);
  else doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text("No platform-verified capabilities yet.", left, contentTop);

  const credentialX = left + columnWidth + columnGap;
  if (credentials.length) {
    credentials.forEach((credential, index) => {
      const y = contentTop + index * mm(22);
      doc.roundedRect(credentialX, y, columnWidth, mm(19), 5).fill(index % 2 ? "#FFFFFF" : pale);
      doc.lineWidth(0.45).strokeColor(line).roundedRect(credentialX, y, columnWidth, mm(19), 5).stroke();
      doc.circle(credentialX + mm(6), y + mm(9.5), mm(2.5)).fill(green);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ink).text(credential.name, credentialX + mm(12), y + mm(3), { width: columnWidth - mm(17) });
      doc.font("Helvetica").fontSize(7).fillColor(GREY).text(credential.issuer_name, credentialX + mm(12), y + mm(10), { width: columnWidth - mm(17) });
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(green).text(credential.expiry_date ? `EXPIRES ${credential.expiry_date}` : "NO EXPIRY", credentialX + mm(12), y + mm(14), { width: columnWidth - mm(17) });
    });
  } else {
    doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text("No platform-verified credentials yet.", credentialX, contentTop);
  }

  const maxRows = Math.max(ordered.length, credentials.length * 1.4, 1);
  const verificationTop = contentTop + maxRows * mm(16) + mm(6);
  const panelTop = Math.min(verificationTop, doc.page.height - doc.page.margins.bottom - mm(47));
  doc.roundedRect(left, panelTop, width, mm(41), 7).fill(navy);
  doc.roundedRect(left + mm(5), panelTop + mm(4), mm(33), mm(33), 4).fill("#FFFFFF");
  doc.image(qr, left + mm(7), panelTop + mm(6), { width: mm(29), height: mm(29) });
  const verifyX = left + mm(45);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text("SCAN TO VERIFY THIS PASSPORT", verifyX, panelTop + mm(6), { width: width - mm(52) });
  doc.font("Helvetica").fontSize(8).fillColor("#C7E9E5").text("Live ThermaTrust records confirm whether these skills and credentials are still verified.", verifyX, panelTop + mm(14), { width: width - mm(52) });
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#FFFFFF").text("INTEGRITY DIGEST · SHA-256", verifyX, panelTop + mm(27), { width: width - mm(52) });
  doc.font("Courier").fontSize(6).fillColor("#C7E9E5").text(`${digest.slice(0, 32)}\n${digest.slice(32)}`, verifyX, panelTop + mm(31), { width: width - mm(52) });
  doc.font("Helvetica").fontSize(7).fillColor(GREY).text(config.frontendUrl, left, doc.page.height - doc.page.margins.bottom - mm(8), { width, align: "center" });
  doc.font("Helvetica").fontSize(6.5).fillColor("#78909C").text("ThermaTrust · Live professional verification · Keep this document with the technician record.", left, doc.page.height - doc.page.margins.bottom - mm(3), { width, align: "center" });
  return finish();
}
