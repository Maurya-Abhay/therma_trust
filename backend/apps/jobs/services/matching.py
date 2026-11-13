"""Risk-based technician matching.

Filters to available technicians, scores them against a job's required
capabilities plus experience/location/contractor-trust signals, and flags
exactly which required capabilities each candidate is missing so the
frontend can warn a facility manager before an unsafe assignment.
"""
from apps.core.choices import CapabilityStatus, CapabilityType, ContractorVerificationStatus
from apps.technicians.models import CapabilitySkill, TechnicianProfile

REQUIRED_CAPABILITY_SCORE = 20
PENDING_CAPABILITY_SCORE = 5
WORK_HISTORY_SCORE_PER_ENTRY = 2
WORK_HISTORY_SCORE_CAP = 10
EXPERIENCE_SCORE_CAP = 10
LOCATION_MATCH_SCORE = 10
CONTRACTOR_VERIFIED_SCORE = 10


def _skill_lookup(technician):
    lookup = {}
    for skill in technician.capabilities.all():
        if skill.capability_type == CapabilityType.EQUIPMENT:
            key = ("equipment", skill.equipment_category)
        elif skill.capability_type == CapabilityType.REFRIGERANT:
            key = ("refrigerant", skill.refrigerant_type_id)
        else:
            key = ("safety", skill.safety_domain)
        lookup[key] = skill
    return lookup


def _requirement_key(requirement):
    return (requirement["capability_type"], requirement["key"])


def score_technician(technician, job, skill_lookup=None):
    skill_lookup = skill_lookup if skill_lookup is not None else _skill_lookup(technician)
    score = 0
    breakdown = {}
    missing_requirements = []

    for requirement in job.required_capabilities:
        skill = skill_lookup.get(_requirement_key(requirement))
        if skill and skill.status == CapabilityStatus.VERIFIED:
            score += REQUIRED_CAPABILITY_SCORE
        elif skill and skill.status == CapabilityStatus.PENDING:
            score += PENDING_CAPABILITY_SCORE
            missing_requirements.append({**requirement, "reason": "capability pending verification"})
        else:
            missing_requirements.append({**requirement, "reason": "no verified capability on file"})
    breakdown["capability_score"] = score

    equipment_category = job.equipment.category
    history_count = technician.work_history.filter(equipment_category=equipment_category).count()
    history_score = min(history_count * WORK_HISTORY_SCORE_PER_ENTRY, WORK_HISTORY_SCORE_CAP)
    score += history_score
    breakdown["work_history_score"] = history_score

    experience_score = min(technician.years_experience, EXPERIENCE_SCORE_CAP)
    score += experience_score
    breakdown["experience_score"] = experience_score

    facility_area = (job.facility.service_area or "").strip().lower()
    technician_area = (technician.service_area or "").strip().lower()
    location_score = 0
    if facility_area and technician_area and facility_area == technician_area:
        location_score = LOCATION_MATCH_SCORE
    score += location_score
    breakdown["location_score"] = location_score

    contractor_score = 0
    if technician.contractor and technician.contractor.verification_status == ContractorVerificationStatus.VERIFIED:
        contractor_score = CONTRACTOR_VERIFIED_SCORE
    score += contractor_score
    breakdown["contractor_score"] = contractor_score

    return {
        "technician": technician,
        "score": score,
        "breakdown": breakdown,
        "missing_requirements": missing_requirements,
        "is_qualified": len(missing_requirements) == 0,
    }


def rank_technicians(job):
    technicians = (
        TechnicianProfile.objects.filter(available=True)
        .select_related("user", "contractor")
        .prefetch_related("capabilities", "work_history")
    )
    results = [score_technician(technician, job) for technician in technicians]
    results.sort(key=lambda r: r["score"], reverse=True)
    return results
