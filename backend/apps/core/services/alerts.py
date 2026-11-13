"""Proactive compliance alerts, computed from live data per user.

Alerts are derived, not stored: they vanish the moment the underlying problem
is fixed, so there is nothing to dismiss, acknowledge or let go stale. The same
function powers the in-app bell and the emailed digest.
"""
import datetime
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.core.choices import CapabilityStatus, ContractorVerificationStatus, CredentialStatus

CREDENTIAL_EXPIRY_WARNING_DAYS = 30
LOW_COMPLIANCE_SCORE = 70
LOW_CYLINDER_FRACTION = Decimal("0.10")

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


def _alert(key, severity, category, title, detail, link):
    return {"id": key, "severity": severity, "category": category, "title": title, "detail": detail, "link": link}


def _credential_alerts(credentials, owner_label, link, key_prefix):
    """Expired or soon-to-expire credentials. Only ones that were actually
    platform-verified matter — an unverified credential has nothing to lose."""
    today = timezone.now().date()
    soon = today + datetime.timedelta(days=CREDENTIAL_EXPIRY_WARNING_DAYS)
    alerts = []
    for credential in credentials:
        who = f"{owner_label}'s " if owner_label else "Your "
        if credential.effective_status == CredentialStatus.EXPIRED:
            alerts.append(_alert(
                f"{key_prefix}:expired:{credential.id}", "critical", "credential",
                f"{who}{credential.name} has expired",
                f"It expired on {credential.expiry_date}. Work needing this credential should not be assigned.",
                link,
            ))
        elif (
            credential.status == CredentialStatus.PLATFORM_VERIFIED
            and credential.expiry_date
            and credential.expiry_date <= soon
        ):
            days = (credential.expiry_date - today).days
            alerts.append(_alert(
                f"{key_prefix}:expiring:{credential.id}", "warning", "credential",
                f"{who}{credential.name} expires in {days} day{'s' if days != 1 else ''}",
                f"Expires on {credential.expiry_date}. Renew it before then to stay verified.",
                link,
            ))
    return alerts


def _facility_manager_alerts(user):
    from apps.facilities.models import Equipment
    from apps.facilities.services.leak_rate import compute_leak_rate
    from apps.servicereports.services.drift import detect_drift

    alerts = []
    for equipment in Equipment.objects.filter(facility__owner=user).select_related("facility"):
        leak = compute_leak_rate(equipment)
        if leak["exceeds_threshold"]:
            alerts.append(_alert(
                f"leak:{equipment.id}", "critical", "leak_rate",
                f"{equipment.name} is over the leak-rate limit",
                f"{leak['leak_rate_percent']}% of its charge was topped up in the last 12 months "
                f"(limit {leak['threshold_percent']:g}%). Investigate and repair the leak.",
                "/dashboard",
            ))
        for warning in detect_drift(equipment):
            alerts.append(_alert(
                f"drift:{equipment.id}:{warning['metric']}", "warning", "drift",
                f"{equipment.name}: {warning['metric']} is trending {warning['direction']}",
                f"Last three services read {' -> '.join(f'{v:g}' for v in warning['values'])}. "
                "Schedule an inspection before it fails.",
                f"/facilities/{equipment.facility_id}",
            ))
    return alerts


def _technician_alerts(user):
    technician = getattr(user, "technician_profile", None)
    if technician is None:
        return []
    return _credential_alerts(technician.credentials.all(), None, "/credentials", "mycred")


def _contractor_alerts(user):
    from apps.contractors.models import ContractorCompany
    from apps.contractors.services.compliance import compute_compliance
    from apps.servicereports.models import RefrigerantCylinder
    from apps.technicians.models import CapabilitySkill

    alerts = []
    for company in ContractorCompany.objects.filter(manager=user):
        if company.verification_status != ContractorVerificationStatus.VERIFIED:
            alerts.append(_alert(
                f"company:{company.id}:unverified", "info", "verification",
                f"{company.name} is not verified yet",
                "An admin reviews your uploaded documents before marking the company verified.",
                "/company",
            ))

        score = compute_compliance(company)["score"]
        if score < LOW_COMPLIANCE_SCORE:
            alerts.append(_alert(
                f"company:{company.id}:score", "warning", "compliance_score",
                f"{company.name} compliance score is {score}/100",
                f"Below {LOW_COMPLIANCE_SCORE}. Get roster capabilities, credentials and documents verified to raise it.",
                "/company",
            ))

        pending = CapabilitySkill.objects.filter(
            technician__contractor=company, status=CapabilityStatus.PENDING
        ).count()
        if pending:
            alerts.append(_alert(
                f"company:{company.id}:pending", "info", "approvals",
                f"{pending} capabilit{'ies' if pending != 1 else 'y'} waiting for your approval",
                "Technicians on your roster are waiting to be verified.",
                "/team-capabilities",
            ))

        for technician in company.technicians.select_related("user").prefetch_related("credentials"):
            name = technician.user.get_full_name() or technician.user.email
            alerts += _credential_alerts(technician.credentials.all(), name, "/roster", f"roster{technician.id}")

        for cylinder in RefrigerantCylinder.objects.filter(
            company=company, kind=RefrigerantCylinder.Kind.SUPPLY
        ).select_related("refrigerant_type"):
            if cylinder.capacity_kg > 0 and cylinder.current_kg <= cylinder.capacity_kg * LOW_CYLINDER_FRACTION:
                alerts.append(_alert(
                    f"cylinder:{cylinder.id}:low", "warning", "cylinder",
                    f"Cylinder {cylinder.serial_number} is nearly empty",
                    f"{cylinder.current_kg} kg of {cylinder.refrigerant_type.code} left "
                    f"(capacity {cylinder.capacity_kg} kg).",
                    "/cylinders",
                ))
    return alerts


def _admin_alerts(user):
    from apps.contractors.models import ContractorCompany, ContractorDocument
    from apps.core.models import AuditLog
    from apps.technicians.models import CapabilitySkill, Credential

    alerts = []
    is_valid, broken_at_id = AuditLog.verify_chain()
    if not is_valid:
        alerts.append(_alert(
            "audit:broken", "critical", "audit",
            "Audit log tampering detected",
            f"The hash chain breaks at entry #{broken_at_id}. A record was changed or removed outside the app.",
            "/admin",
        ))

    queues = [
        ("credential", "credentials", Credential.objects.filter(status=CredentialStatus.PENDING).count(),
         "/admin/credentials"),
        ("capability", "capabilities", CapabilitySkill.objects.filter(status=CapabilityStatus.PENDING).count(),
         "/admin/capabilities"),
        ("contractor document", "contractor documents",
         ContractorDocument.objects.filter(status=ContractorDocument.Status.PENDING).count(),
         "/admin/contractor-documents"),
        ("contractor verification", "contractor verifications",
         ContractorCompany.objects.filter(verification_status=ContractorVerificationStatus.PENDING).count(),
         "/admin/contractor-verifications"),
    ]
    for singular, plural, count, link in queues:
        if count:
            label = singular if count == 1 else plural
            alerts.append(_alert(
                f"queue:{plural}", "info", "review_queue", f"{count} {label} awaiting review",
                "Open the queue to approve or reject them.", link,
            ))
    return alerts


def compute_alerts(user):
    role = user.role
    if role == "facility_manager":
        alerts = _facility_manager_alerts(user)
    elif role == "technician":
        alerts = _technician_alerts(user)
    elif role == "contractor_manager":
        alerts = _contractor_alerts(user)
    elif role == "admin" or user.is_staff:
        alerts = _admin_alerts(user)
    else:
        alerts = []
    return sorted(alerts, key=lambda a: (SEVERITY_ORDER[a["severity"]], a["id"]))


def send_alert_digests():
    """Email each user whose alerts include anything actionable (critical or
    warning). Info-level items are in-app only. Returns the number of emails sent."""
    from apps.accounts.models import User

    sent = 0
    base = settings.FRONTEND_URL.rstrip("/")
    for user in User.objects.filter(is_active=True).exclude(email=""):
        actionable = [a for a in compute_alerts(user) if a["severity"] in ("critical", "warning")]
        if not actionable:
            continue
        lines = [f"Hi {user.first_name or user.email},", "", "These items need your attention on ThermaTrust:", ""]
        for alert in actionable:
            lines += [f"[{alert['severity'].upper()}] {alert['title']}", f"  {alert['detail']}", f"  {base}{alert['link']}", ""]
        send_mail(
            subject=f"ThermaTrust: {len(actionable)} compliance alert{'s' if len(actionable) != 1 else ''} need attention",
            message="\n".join(lines),
            from_email=None,
            recipient_list=[user.email],
        )
        sent += 1
    return sent
