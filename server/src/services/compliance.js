import { CapabilitySkill, ContractorDocument, Credential, TechnicianProfile } from "../models/index.js";
import { todayString } from "../lib/dates.js";

/**
 * Contractor compliance scoring: rolls a roster up into one number instead of
 * the binary "approved once" verification status. How much of their declared
 * capability, credentials and documents is actually verified right now.
 */
export const CAPABILITY_WEIGHT = 50;
export const CREDENTIAL_WEIGHT = 30;
export const DOCUMENT_WEIGHT = 20;

/** A platform-verified credential past its expiry date no longer counts. */
export function effectiveCredentialStatus(credential, today = todayString()) {
  if (credential.status === "platform_verified" && credential.expiry_date && credential.expiry_date < today) {
    return "expired";
  }
  return credential.status;
}

export async function computeCompliance(company) {
  const technicians = await TechnicianProfile.find({ contractor: company._id }, { _id: 1 }).lean();
  const ids = technicians.map((t) => t._id);

  const [capabilities, credentials, documents] = await Promise.all([
    ids.length ? CapabilitySkill.find({ technician: { $in: ids } }, { status: 1 }).lean() : [],
    ids.length ? Credential.find({ technician: { $in: ids } }, { status: 1, expiry_date: 1 }).lean() : [],
    ContractorDocument.find({ company: company._id }, { status: 1 }).lean(),
  ]);

  const rate = (list, predicate) => (list.length ? list.filter(predicate).length / list.length : 0);
  const capabilityRate = rate(capabilities, (c) => c.status === "verified");
  const credentialRate = rate(credentials, (c) => effectiveCredentialStatus(c) === "platform_verified");
  const documentRate = rate(documents, (d) => d.status === "verified");

  return {
    score: Math.round(
      capabilityRate * CAPABILITY_WEIGHT + credentialRate * CREDENTIAL_WEIGHT + documentRate * DOCUMENT_WEIGHT
    ),
    technician_count: technicians.length,
    capability_verified_rate: Math.round(capabilityRate * 100),
    credential_verified_rate: Math.round(credentialRate * 100),
    document_verified_rate: Math.round(documentRate * 100),
    company_verified: company.verification_status === "verified",
  };
}
