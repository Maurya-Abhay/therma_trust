import {
  CapabilitySkill, ContractorCompany, ContractorDocument, Credential, Equipment, Facility, RefrigerantCylinder,
  RefrigerantType, TechnicianProfile, User, fullNameOf, isAdmin,
} from "../models/index.js";
import { addDaysString, daysBetween, todayString } from "../lib/dates.js";
import { num } from "../lib/decimal.js";
import { config } from "../config.js";
import { computeCompliance, effectiveCredentialStatus } from "./compliance.js";
import { detectDriftBatch } from "./drift.js";
import { computeLeakRates } from "./leakRate.js";
import { verifyChain } from "./audit.js";
import { sendMail } from "./email.js";

/**
 * Proactive compliance alerts, computed from live data per user.
 *
 * Alerts are derived, not stored: they vanish the moment the underlying problem
 * is fixed, so there is nothing to dismiss or let go stale. The same function
 * powers the in-app bell and the emailed digest.
 */
export const CREDENTIAL_EXPIRY_WARNING_DAYS = 30;
export const LOW_COMPLIANCE_SCORE = 70;
export const LOW_CYLINDER_FRACTION = 0.1;
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

const alert = (id, severity, category, title, detail, link) => ({ id, severity, category, title, detail, link });
const plural = (n, one, many) => (n === 1 ? one : many);
// Whole percentages print with one decimal ("25.0"), as they always have in alert text.
const oneDecimal = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

function credentialAlerts(credentials, ownerLabel, link, keyPrefix) {
  const today = todayString();
  const soon = addDaysString(today, CREDENTIAL_EXPIRY_WARNING_DAYS);
  const who = ownerLabel ? `${ownerLabel}'s ` : "Your ";
  const alerts = [];
  for (const credential of credentials) {
    if (effectiveCredentialStatus(credential, today) === "expired") {
      alerts.push(alert(
        `${keyPrefix}:expired:${credential._id}`, "critical", "credential",
        `${who}${credential.name} has expired`,
        `It expired on ${credential.expiry_date}. Work needing this credential should not be assigned.`, link
      ));
    } else if (credential.status === "platform_verified" && credential.expiry_date && credential.expiry_date <= soon) {
      const days = daysBetween(today, credential.expiry_date);
      alerts.push(alert(
        `${keyPrefix}:expiring:${credential._id}`, "warning", "credential",
        `${who}${credential.name} expires in ${days} day${days !== 1 ? "s" : ""}`,
        `Expires on ${credential.expiry_date}. Renew it before then to stay verified.`, link
      ));
    }
  }
  return alerts;
}

async function facilityManagerAlerts(user) {
  const facilities = await Facility.find({ owner: user._id }, { _id: 1 }).lean();
  const equipment = facilities.length ? await Equipment.find({ facility: { $in: facilities.map((f) => f._id) } }).lean() : [];
  const [leaks, drifts] = await Promise.all([computeLeakRates(equipment), detectDriftBatch(equipment.map((e) => e._id))]);

  const alerts = [];
  for (const unit of equipment) {
    const leak = leaks.get(unit._id);
    if (leak.exceeds_threshold) {
      alerts.push(alert(
        `leak:${unit._id}`, "critical", "leak_rate", `${unit.name} is over the leak-rate limit`,
        `${oneDecimal(leak.leak_rate_percent)}% of its charge was topped up in the last 12 months ` +
          `(limit ${leak.threshold_percent}%). Investigate and repair the leak.`,
        "/dashboard"
      ));
    }
    for (const warning of drifts.get(unit._id) ?? []) {
      alerts.push(alert(
        `drift:${unit._id}:${warning.metric}`, "warning", "drift",
        `${unit.name}: ${warning.metric} is trending ${warning.direction}`,
        `Last three services read ${warning.values.join(" -> ")}. Schedule an inspection before it fails.`,
        `/facilities/${unit.facility}`
      ));
    }
  }
  return alerts;
}

async function technicianAlerts(user) {
  const profile = await TechnicianProfile.findOne({ user: user._id }, { _id: 1 }).lean();
  if (!profile) return [];
  const credentials = await Credential.find({ technician: profile._id }).lean();
  return credentialAlerts(credentials, null, "/credentials", "mycred");
}

async function contractorAlerts(user) {
  const companies = await ContractorCompany.find({ manager: user._id }).lean();
  const alerts = [];

  for (const company of companies) {
    if (company.verification_status !== "verified") {
      alerts.push(alert(
        `company:${company._id}:unverified`, "info", "verification", `${company.name} is not verified yet`,
        "An admin reviews your uploaded documents before marking the company verified.", "/company"
      ));
    }

    const { score } = await computeCompliance(company);
    if (score < LOW_COMPLIANCE_SCORE) {
      alerts.push(alert(
        `company:${company._id}:score`, "warning", "compliance_score", `${company.name} compliance score is ${score}/100`,
        `Below ${LOW_COMPLIANCE_SCORE}. Get roster capabilities, credentials and documents verified to raise it.`, "/company"
      ));
    }

    const roster = await TechnicianProfile.find({ contractor: company._id }).lean();
    const rosterIds = roster.map((t) => t._id);
    const pending = rosterIds.length
      ? await CapabilitySkill.countDocuments({ technician: { $in: rosterIds }, status: "pending" })
      : 0;
    if (pending) {
      alerts.push(alert(
        `company:${company._id}:pending`, "info", "approvals",
        `${pending} capabilit${plural(pending, "y", "ies")} waiting for your approval`,
        "Technicians on your roster are waiting to be verified.", "/team-capabilities"
      ));
    }

    if (roster.length) {
      const [users, credentials] = await Promise.all([
        User.find({ _id: { $in: roster.map((t) => t.user) } }).lean(),
        Credential.find({ technician: { $in: rosterIds } }).lean(),
      ]);
      const userBy = new Map(users.map((u) => [u._id, u]));
      for (const technician of roster) {
        const name = fullNameOf(userBy.get(technician.user) ?? { email: "" });
        const own = credentials.filter((c) => c.technician === technician._id);
        alerts.push(...credentialAlerts(own, name, "/roster", `roster${technician._id}`));
      }
    }

    const cylinders = await RefrigerantCylinder.find({ company: company._id, kind: "supply" }).lean();
    const refrigerants = new Map(
      (await RefrigerantType.find({ _id: { $in: cylinders.map((c) => c.refrigerant_type) } }).lean()).map((r) => [r._id, r])
    );
    for (const cylinder of cylinders) {
      const capacity = num(cylinder.capacity_kg);
      const current = num(cylinder.current_kg);
      if (capacity > 0 && current <= capacity * LOW_CYLINDER_FRACTION) {
        alerts.push(alert(
          `cylinder:${cylinder._id}:low`, "warning", "cylinder", `Cylinder ${cylinder.serial_number} is nearly empty`,
          `${current.toFixed(2)} kg of ${refrigerants.get(cylinder.refrigerant_type)?.code ?? "refrigerant"} left (capacity ${capacity.toFixed(2)} kg).`,
          "/cylinders"
        ));
      }
    }
  }
  return alerts;
}

async function adminAlerts() {
  const alerts = [];
  const chain = await verifyChain();
  if (!chain.valid) {
    alerts.push(alert(
      "audit:broken", "critical", "audit", "Audit log tampering detected",
      `The hash chain breaks at entry #${chain.brokenAtId}. A record was changed or removed outside the app.`, "/admin"
    ));
  }

  const queues = [
    ["credential", "credentials", await Credential.countDocuments({ status: "pending" }), "/admin/credentials"],
    ["capability", "capabilities", await CapabilitySkill.countDocuments({ status: "pending" }), "/admin/capabilities"],
    ["contractor document", "contractor documents", await ContractorDocument.countDocuments({ status: "pending" }), "/admin/contractor-documents"],
    [
      "contractor verification", "contractor verifications",
      await ContractorCompany.countDocuments({ verification_status: "pending" }), "/admin/contractor-verifications",
    ],
  ];
  for (const [singular, pluralLabel, count, link] of queues) {
    if (count) {
      alerts.push(alert(
        `queue:${pluralLabel}`, "info", "review_queue",
        `${count} ${count === 1 ? singular : pluralLabel} awaiting review`, "Open the queue to approve or reject them.", link
      ));
    }
  }
  return alerts;
}

export async function computeAlerts(user) {
  let alerts = [];
  if (user.role === "facility_manager") alerts = await facilityManagerAlerts(user);
  else if (user.role === "technician") alerts = await technicianAlerts(user);
  else if (user.role === "contractor_manager") alerts = await contractorAlerts(user);
  else if (isAdmin(user)) alerts = await adminAlerts();
  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Email each user whose alerts include anything actionable (critical or
 * warning). Info-level items stay in the app. Returns how many were sent.
 */
export async function sendAlertDigests() {
  let sent = 0;
  const users = await User.find({ is_active: true, email: { $ne: "" } }).lean();
  for (const user of users) {
    const actionable = (await computeAlerts(user)).filter((a) => a.severity === "critical" || a.severity === "warning");
    if (!actionable.length) continue;
    const lines = [`Hi ${user.first_name || user.email},`, "", "These items need your attention on ThermaTrust:", ""];
    for (const item of actionable) {
      lines.push(`[${item.severity.toUpperCase()}] ${item.title}`, `  ${item.detail}`, `  ${config.frontendUrl}${item.link}`, "");
    }
    await sendMail({
      to: user.email,
      subject: `ThermaTrust: ${actionable.length} compliance alert${actionable.length !== 1 ? "s" : ""} need attention`,
      text: lines.join("\n"),
    });
    sent += 1;
  }
  return sent;
}
