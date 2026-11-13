"""Cross-record search for the command palette, scoped to what the caller may see."""
from django.db.models import Q

LIMIT = 5


def _facility_manager(user, q):
    from apps.facilities.models import Equipment, Facility
    from apps.jobs.models import JobRequest

    out = []
    for f in Facility.objects.filter(owner=user).filter(Q(name__icontains=q) | Q(address__icontains=q))[:LIMIT]:
        out.append({"type": "facility", "id": f.id, "title": f.name, "subtitle": f.address, "link": f"/facilities/{f.id}"})
    equipment = Equipment.objects.filter(facility__owner=user).filter(
        Q(name__icontains=q) | Q(refrigerant_type__code__icontains=q)
    ).select_related("facility")[:LIMIT]
    for e in equipment:
        out.append({
            "type": "equipment", "id": e.id, "title": e.name,
            "subtitle": f"{e.facility.name} - {e.refrigerant_type.code}", "link": f"/equipment/{e.id}",
        })
    jobs = JobRequest.objects.filter(facility__owner=user).filter(
        Q(description__icontains=q) | Q(equipment__name__icontains=q)
    ).select_related("equipment")[:LIMIT]
    for j in jobs:
        out.append({
            "type": "job", "id": j.id, "title": f"Job #{j.id} - {j.equipment.name}",
            "subtitle": f"{j.get_status_display()} - {j.get_risk_level_display() if j.risk_level else ''}".strip(" -"),
            "link": f"/jobs/{j.id}",
        })
    return out


def _technician(user, q):
    from apps.jobs.models import JobRequest

    out = []
    jobs = JobRequest.objects.filter(assignment__technician__user=user).filter(
        Q(description__icontains=q) | Q(equipment__name__icontains=q) | Q(facility__name__icontains=q)
    ).select_related("equipment", "facility")[:LIMIT]
    for j in jobs:
        out.append({
            "type": "job", "id": j.id, "title": f"Job #{j.id} - {j.equipment.name}",
            "subtitle": j.facility.name, "link": f"/my-jobs/{j.id}/report",
        })
    return out


def _contractor(user, q):
    from apps.servicereports.models import RefrigerantCylinder
    from apps.technicians.models import TechnicianProfile

    out = []
    people = TechnicianProfile.objects.filter(contractor__manager=user).filter(
        Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q) | Q(user__email__icontains=q)
    ).select_related("user")[:LIMIT]
    for p in people:
        out.append({
            "type": "technician", "id": p.id, "title": p.user.get_full_name() or p.user.email,
            "subtitle": p.user.email, "link": "/roster",
        })
    cylinders = RefrigerantCylinder.objects.filter(company__manager=user).filter(
        Q(serial_number__icontains=q) | Q(refrigerant_type__code__icontains=q)
    ).select_related("refrigerant_type")[:LIMIT]
    for c in cylinders:
        out.append({
            "type": "cylinder", "id": c.id, "title": c.serial_number,
            "subtitle": f"{c.refrigerant_type.code} - {c.current_kg} kg", "link": "/cylinders",
        })
    return out


def _admin(user, q):
    from apps.technicians.models import Credential

    out = []
    credentials = Credential.objects.filter(
        Q(name__icontains=q) | Q(technician__user__email__icontains=q) | Q(issuer_name__icontains=q)
    ).select_related("technician__user")[:LIMIT]
    for c in credentials:
        out.append({
            "type": "credential", "id": c.id, "title": c.name,
            "subtitle": c.technician.user.get_full_name() or c.technician.user.email,
            "link": "/admin/credentials",
        })
    return out


def search(user, query):
    q = (query or "").strip()
    if len(q) < 2:
        return []
    if user.role == "facility_manager":
        return _facility_manager(user, q)
    if user.role == "technician":
        return _technician(user, q)
    if user.role == "contractor_manager":
        return _contractor(user, q)
    if user.role == "admin" or user.is_staff:
        return _admin(user, q)
    return []
