import hmac

from django.conf import settings
from django.db import connection
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import choices
from .models import AuditLog, Notification, PushSubscription, RefrigerantType
from .serializers import RefrigerantTypeSerializer
from .services.alerts import compute_alerts, send_alert_digests


class HealthView(APIView):
    """Unauthenticated liveness check.

    Pinged on a schedule so the free-tier host never goes to sleep. It runs a
    trivial query so the database (also free-tier, pauses when idle) stays awake too.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return Response({"status": "ok"})


class NotificationsView(APIView):
    """The caller's own notifications, newest first, plus an unread count."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        own = Notification.objects.filter(user=request.user)
        items = own[:30]
        return Response(
            {
                "unread_count": own.filter(read_at__isnull=True).count(),
                "results": [
                    {
                        "id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
                        "read": n.read_at is not None, "created_at": n.created_at,
                    }
                    for n in items
                ],
            }
        )


class NotificationsReadView(APIView):
    """Mark some (`ids`) or all (`all: true`) of the caller's notifications read."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.utils import timezone

        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)
        if not request.data.get("all"):
            ids = request.data.get("ids") or []
            if not isinstance(ids, list):
                ids = []
            qs = qs.filter(id__in=[i for i in ids if isinstance(i, int)])
        updated = qs.update(read_at=timezone.now())
        return Response({"updated": updated})


class PushKeyView(APIView):
    """The public VAPID key browsers need to subscribe; `enabled` is false until the server has keys."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .services.push import push_enabled

        return Response({"enabled": push_enabled(), "public_key": settings.VAPID_PUBLIC_KEY if push_enabled() else ""})


class PushSubscribeView(APIView):
    """Register (or move to this user) a browser's push subscription."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from rest_framework.exceptions import ValidationError

        endpoint = request.data.get("endpoint")
        keys = request.data.get("keys") or {}
        p256dh = keys.get("p256dh") if isinstance(keys, dict) else None
        auth = keys.get("auth") if isinstance(keys, dict) else None
        if not (isinstance(endpoint, str) and endpoint.startswith("https://") and len(endpoint) <= 1000):
            raise ValidationError({"endpoint": "A valid https push endpoint is required."})
        if not (isinstance(p256dh, str) and isinstance(auth, str) and p256dh and auth):
            raise ValidationError({"keys": "p256dh and auth keys are required."})

        # The same browser profile can be used by different people in turn, so the
        # latest signed-in user takes over the endpoint.
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "user": request.user,
                "p256dh": p256dh[:200],
                "auth": auth[:100],
                "user_agent": request.headers.get("User-Agent", "")[:300],
            },
        )
        return Response({"subscribed": True}, status=201)


class PushUnsubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get("endpoint")
        deleted = 0
        if isinstance(endpoint, str):
            deleted, _ = PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({"removed": deleted})


class PushTestView(APIView):
    """Send the caller a confirmation notification so they can see push working."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.notify(
            request.user, Notification.Kind.INFO, "Push alerts are on",
            "You will be told here about new jobs, reviews and report decisions.", "/",
        )
        return Response({"sent": True})


class SearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .services.search import search

        return Response({"results": search(request.user, request.query_params.get("q", ""))})


class OnboardingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .services.onboarding import build_checklist

        return Response(build_checklist(request.user))


class RefrigerantTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RefrigerantType.objects.all()
    serializer_class = RefrigerantTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


def _as_options(text_choices):
    return [{"value": value, "label": label} for value, label in text_choices.choices]


class ChoicesView(APIView):
    """Static choice lists for frontend dropdowns."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "equipment_categories": _as_options(choices.EquipmentCategory),
                "safety_domains": _as_options(choices.SafetyDomain),
                "capability_types": _as_options(choices.CapabilityType),
                "evidence_types": _as_options(choices.EvidenceType),
                "capability_statuses": _as_options(choices.CapabilityStatus),
                "credential_statuses": _as_options(choices.CredentialStatus),
                "criticalities": _as_options(choices.Criticality),
                "urgencies": _as_options(choices.Urgency),
                "risk_levels": _as_options(choices.RiskLevel),
                "job_statuses": _as_options(choices.JobStatus),
            }
        )


class AlertsView(APIView):
    """The signed-in user's current compliance alerts (derived live, never stored)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(compute_alerts(request.user))


class SendAlertDigestView(APIView):
    """Lets a free external scheduler trigger the daily email digest, since the
    hosting free tier has no cron. Guarded by a shared secret, not a user login."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        expected = settings.ALERTS_CRON_TOKEN
        supplied = request.headers.get("X-Cron-Token", "")
        if not expected or not hmac.compare_digest(supplied, expected):
            raise PermissionDenied("Invalid or missing cron token.")
        return Response({"emails_sent": send_alert_digests()})


class AuditLogVerifyView(APIView):
    """Confirms the audit log's hash chain is intact — see AuditLog.verify_chain."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.role == "admin" or request.user.is_staff):
            raise PermissionDenied("Admin only.")

        is_valid, broken_at_id = AuditLog.verify_chain()
        return Response(
            {
                "valid": is_valid,
                "broken_at_id": broken_at_id,
                "checked_count": AuditLog.objects.count(),
            }
        )


class AdminDashboardView(APIView):
    """Everything an admin needs to see 'what's waiting on me' at a glance.

    Django Admin stays the place actions actually happen (per the MVP scope
    decision) — this just gives a real overview instead of nothing, since
    admin has no page of its own in the React app.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.role == "admin" or request.user.is_staff):
            raise PermissionDenied("Admin only.")

        from apps.contractors.models import ContractorCompany, ContractorDocument
        from apps.facilities.models import Facility
        from apps.jobs.models import JobRequest
        from apps.technicians.models import CapabilitySkill, Credential, TechnicianProfile

        recent_audit = AuditLog.objects.select_related("actor")[:15]

        return Response(
            {
                "pending_credentials": Credential.objects.filter(status=choices.CredentialStatus.PENDING).count(),
                "pending_capabilities": CapabilitySkill.objects.filter(status=choices.CapabilityStatus.PENDING).count(),
                "pending_contractor_documents": ContractorDocument.objects.filter(
                    status=ContractorDocument.Status.PENDING
                ).count(),
                "pending_contractor_verifications": ContractorCompany.objects.filter(
                    verification_status=choices.ContractorVerificationStatus.PENDING
                ).count(),
                "total_technicians": TechnicianProfile.objects.count(),
                "total_facilities": Facility.objects.count(),
                "total_jobs": JobRequest.objects.count(),
                "recent_audit_log": [
                    {
                        "id": a.id,
                        "actor": a.actor.email if a.actor else None,
                        "action": a.action,
                        "object_type": a.object_type,
                        "object_id": a.object_id,
                        "created_at": a.created_at,
                    }
                    for a in recent_audit
                ],
            }
        )
