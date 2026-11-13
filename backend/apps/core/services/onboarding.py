"""A short, derived "get started" checklist per role.

Nothing is stored: each step is true or false from the data that already
exists, so it can never get out of sync with what the user has really done.
"""


def _step(step_id, title, done, link):
    return {"id": step_id, "title": title, "done": bool(done), "link": link}


def _technician(user):
    from apps.assessments.models import AssessmentAttempt
    from apps.core.choices import JobStatus
    from apps.technicians.models import CapabilitySkill, Credential, TechnicianProfile

    profile = TechnicianProfile.objects.filter(user=user).first()
    if profile is None:
        return []
    return [
        _step("profile", "Complete your profile", profile.service_area and profile.years_experience > 0, "/profile"),
        _step("credential", "Upload a credential", Credential.objects.filter(technician=profile).exists(), "/credentials"),
        _step("capability", "Declare a capability", CapabilitySkill.objects.filter(technician=profile).exists(), "/capabilities"),
        _step(
            "assessment", "Pass a practical assessment",
            AssessmentAttempt.objects.filter(technician=profile, passed=True).exists(), "/assessments",
        ),
        _step(
            "job", "Finish your first job",
            profile.assignments.filter(job__status=JobStatus.COMPLETED).exists(), "/my-jobs",
        ),
    ]


def _facility_manager(user):
    from apps.core.choices import JobStatus
    from apps.facilities.models import Equipment, Facility
    from apps.jobs.models import JobRequest

    return [
        _step("facility", "Add a facility", Facility.objects.filter(owner=user).exists(), "/facilities"),
        _step("equipment", "Register equipment", Equipment.objects.filter(facility__owner=user).exists(), "/facilities"),
        _step("job", "Raise a job request", JobRequest.objects.filter(facility__owner=user).exists(), "/jobs/new"),
        _step(
            "complete", "Complete a job",
            JobRequest.objects.filter(facility__owner=user, status=JobStatus.COMPLETED).exists(), "/jobs",
        ),
    ]


def _contractor(user):
    from apps.contractors.models import ContractorCompany, ContractorDocument
    from apps.servicereports.models import RefrigerantCylinder
    from apps.technicians.models import TechnicianProfile

    company = ContractorCompany.objects.filter(manager=user).first()
    return [
        _step("company", "Register your company", company, "/company"),
        _step(
            "document", "Upload a business document",
            company and ContractorDocument.objects.filter(company=company).exists(), "/company",
        ),
        _step(
            "roster", "Bring a technician onto the roster",
            company and TechnicianProfile.objects.filter(contractor=company).exists(), "/roster",
        ),
        _step(
            "cylinder", "Register a cylinder",
            company and RefrigerantCylinder.objects.filter(company=company).exists(), "/cylinders",
        ),
    ]


def build_checklist(user):
    if user.role == "technician":
        steps = _technician(user)
    elif user.role == "facility_manager":
        steps = _facility_manager(user)
    elif user.role == "contractor_manager":
        steps = _contractor(user)
    else:
        steps = []
    done = sum(1 for s in steps if s["done"])
    return {"steps": steps, "completed": done, "total": len(steps)}
