"""Contractor compliance scoring.

Rolls a contractor's roster up into one number instead of the binary
"we approved this company once" verification_status — how much of their
declared capability and credentials is actually verified right now.
"""
from apps.core.choices import CapabilityStatus, ContractorVerificationStatus, CredentialStatus
from apps.contractors.models import ContractorDocument

CAPABILITY_WEIGHT = 50
CREDENTIAL_WEIGHT = 30
DOCUMENT_WEIGHT = 20


def compute_compliance(contractor):
    technicians = list(contractor.technicians.select_related(None).prefetch_related("capabilities", "credentials"))

    capabilities = [c for t in technicians for c in t.capabilities.all()]
    credentials = [c for t in technicians for c in t.credentials.all()]
    documents = list(contractor.documents.all())

    capability_rate = (
        sum(1 for c in capabilities if c.status == CapabilityStatus.VERIFIED) / len(capabilities)
        if capabilities else 0.0
    )
    credential_rate = (
        sum(1 for c in credentials if c.effective_status == CredentialStatus.PLATFORM_VERIFIED) / len(credentials)
        if credentials else 0.0
    )
    document_rate = (
        sum(1 for d in documents if d.status == ContractorDocument.Status.VERIFIED) / len(documents)
        if documents else 0.0
    )

    score = round(
        capability_rate * CAPABILITY_WEIGHT
        + credential_rate * CREDENTIAL_WEIGHT
        + document_rate * DOCUMENT_WEIGHT
    )

    return {
        "score": score,
        "technician_count": len(technicians),
        "capability_verified_rate": round(capability_rate * 100),
        "credential_verified_rate": round(credential_rate * 100),
        "document_verified_rate": round(document_rate * 100),
        "company_verified": contractor.verification_status == ContractorVerificationStatus.VERIFIED,
    }
