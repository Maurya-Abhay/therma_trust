import crypto from "node:crypto";
import { config } from "../config.js";
import { CapabilitySkill, ContractorCompany, Credential, RefrigerantType, User } from "../models/index.js";
import * as C from "../lib/choices.js";
import { pyJsonDumps } from "../lib/pyjson.js";
import { effectiveCredentialStatus } from "./compliance.js";
import { renderPassport } from "./documents.js";

export { TYPE_LABELS, TYPE_ORDER } from "./documents.js";

/**
 * Verifiable technician passport: the verified-only facts, a digest over them,
 * and a printable PDF that embeds that digest in its QR code.
 *
 * The digest is what makes a *printed* passport checkable later: scanning the
 * QR re-computes it from live records, so a passport goes "outdated" the moment
 * a capability is revoked or a credential expires.
 */
export function capabilityLabel(skill, refrigerantById) {
  if (skill.capability_type === "equipment") return C.EquipmentCategory.label(skill.equipment_category);
  if (skill.capability_type === "refrigerant") return refrigerantById.get(skill.refrigerant_type)?.code ?? "?";
  return C.SafetyDomain.label(skill.safety_domain);
}

/** Only what the platform has verified: nothing pending, no contact details. */
export async function verifiedFacts(technician) {
  const [skills, credentials, refrigerants] = await Promise.all([
    CapabilitySkill.find({ technician: technician._id, status: "verified" }).sort({ _id: 1 }).lean(),
    Credential.find({ technician: technician._id }).sort({ _id: 1 }).lean(),
    RefrigerantType.find({}).lean(),
  ]);
  const refrigerantById = new Map(refrigerants.map((r) => [r._id, r]));
  return {
    capabilities: skills.map((skill) => ({
      label: capabilityLabel(skill, refrigerantById),
      capability_type: skill.capability_type,
      verified_at: skill.verified_at,
    })),
    credentials: credentials
      .filter((credential) => effectiveCredentialStatus(credential) === "platform_verified")
      .map((credential) => ({
        name: credential.name,
        issuer_name: credential.issuer_name,
        expiry_date: credential.expiry_date,
      })),
  };
}

export async function passportContext(technician) {
  const [user, contractor] = await Promise.all([
    User.findById(technician.user).lean(),
    technician.contractor ? ContractorCompany.findById(technician.contractor).lean() : null,
  ]);
  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.email;
  return { user, contractor, displayName };
}

export function computeDigest(technician, { displayName, contractor }, capabilities, credentials) {
  // Timestamps are left out on purpose: re-verifying the same capability
  // should not invalidate a passport, only a real change in what is verified.
  const canonical = {
    token: String(technician.public_token),
    name: displayName,
    contractor: contractor ? contractor.name : null,
    capabilities: capabilities.map((c) => `${c.capability_type}:${c.label}`).sort(),
    credentials: credentials.map((c) => `${c.name}|${c.issuer_name}|${c.expiry_date || ""}`).sort(),
  };
  return crypto.createHash("sha256").update(pyJsonDumps(canonical, { compact: true })).digest("hex");
}

export async function passportDigest(technician) {
  const [context, facts] = await Promise.all([passportContext(technician), verifiedFacts(technician)]);
  return computeDigest(technician, context, facts.capabilities, facts.credentials);
}

export const passportVerifyUrl = (technician, digest) =>
  `${config.frontendUrl}/verify/${technician.public_token}?hash=${digest}`;

export async function renderPassportPdf(technician) {
  const [context, facts] = await Promise.all([passportContext(technician), verifiedFacts(technician)]);
  const digest = computeDigest(technician, context, facts.capabilities, facts.credentials);
  const bytes = await renderPassport({
    displayName: context.displayName,
    contractorName: context.contractor?.name ?? null,
    yearsExperience: technician.years_experience,
    capabilities: facts.capabilities,
    credentials: facts.credentials,
    digest,
    verifyUrl: passportVerifyUrl(technician, digest),
  });
  return { bytes, digest };
}
