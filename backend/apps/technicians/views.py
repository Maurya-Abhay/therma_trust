from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.choices import CapabilityStatus, CredentialStatus
from apps.core.models import AuditLog, Notification

from .models import CapabilitySkill, Credential, TechnicianProfile, WorkHistoryEntry
from .services import credential_ocr
from .serializers import (
    CapabilitySkillSerializer,
    CredentialSerializer,
    TechnicianProfileSerializer,
    WorkHistoryEntrySerializer,
)


class TechnicianProfileViewSet(viewsets.ModelViewSet):
    serializer_class = TechnicianProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["contractor", "available"]

    def get_queryset(self):
        user = self.request.user
        qs = TechnicianProfile.objects.select_related("user", "contractor").order_by("id")
        if user.role == "technician":
            return qs.filter(user=user)
        if user.role == "contractor_manager":
            return qs.filter(contractor__manager=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    @action(detail=False, methods=["get"])
    def me(self, request):
        profile = TechnicianProfile.objects.select_related("user", "contractor").filter(user=request.user).first()
        if profile is None:
            return Response({"detail": "No technician profile for this account."}, status=404)
        return Response(TechnicianProfileSerializer(profile).data)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in permissions.SAFE_METHODS:
            if request.user.role == "technician" and obj.user_id == request.user.id:
                return
            raise PermissionDenied("Only a technician can edit their own profile.")


class OwnTechnicianScopedMixin:
    """Restricts write access to the technician who owns the parent TechnicianProfile."""

    def _technician_field(self):
        return "technician"

    def get_queryset(self):
        qs = self.queryset_base()
        user = self.request.user
        if user.role == "technician":
            return qs.filter(**{f"{self._technician_field()}__user": user})
        if user.role == "contractor_manager":
            return qs.filter(**{f"{self._technician_field()}__contractor__manager": user})
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        technician = serializer.validated_data.get("technician")
        user = self.request.user
        if user.role != "technician" or technician is None or technician.user_id != user.id:
            raise PermissionDenied("Only technicians can add records to their own profile.")
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        technician = serializer.instance.technician
        if user.role != "technician" or technician.user_id != user.id:
            raise PermissionDenied("Only technicians can update records on their own profile.")
        serializer.save(technician=technician)

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role != "technician" or instance.technician.user_id != user.id:
            raise PermissionDenied("Only technicians can remove records from their own profile.")
        instance.delete()


class CredentialViewSet(OwnTechnicianScopedMixin, viewsets.ModelViewSet):
    serializer_class = CredentialSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["technician", "status"]
    # Only `extract` opts in to ScopedRateThrottle; the scope has to live on the
    # class because @action can only override attributes that already exist.
    throttle_scope = "credential_ocr"

    def queryset_base(self):
        return Credential.objects.select_related("technician__user").order_by("-created_at")

    def perform_update(self, serializer):
        user = self.request.user
        technician = serializer.instance.technician
        if user.role != "technician" or technician.user_id != user.id:
            raise PermissionDenied("Only the credential owner can edit their submission.")
        serializer.save(
            technician=technician,
            status=CredentialStatus.PENDING,
            reviewed_by=None,
            reviewed_at=None,
            ai_check=None,
        )

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser], throttle_classes=[ScopedRateThrottle])
    def extract(self, request):
        """Read an uploaded credential photo/PDF into suggested form fields.

        Nothing is saved - the technician reviews the suggestions and submits
        the credential normally.
        """
        if request.user.role != "technician":
            raise PermissionDenied("Only technicians can scan their own credentials.")

        upload = request.FILES.get("file")
        if upload is None:
            return Response({"detail": "Attach a file to scan."}, status=400)
        if upload.size > credential_ocr.MAX_UPLOAD_BYTES:
            return Response({"detail": "That file is too large to scan (limit 5 MB)."}, status=400)

        data = upload.read()
        media_type = credential_ocr.detect_media_type(data)
        if media_type is None:
            return Response({"detail": "Upload a PDF or a JPEG, PNG, GIF or WebP image."}, status=400)

        try:
            extracted = credential_ocr.extract_credential_fields(data, media_type)
        except credential_ocr.OcrUnavailable as exc:
            return Response({"detail": str(exc)}, status=503)
        except credential_ocr.OcrFailed as exc:
            return Response({"detail": str(exc)}, status=502)
        return Response(extracted.model_dump())

    @action(detail=True, methods=["post"], url_path="ai-check")
    def ai_check(self, request, pk=None):
        """Admin: have the model read the stored document and flag mismatches."""
        if not (request.user.role == "admin" or request.user.is_staff):
            raise PermissionDenied("Only admins can run an AI check.")

        credential = self.get_object()
        try:
            with credential.file.open("rb") as handle:
                data = handle.read()
        except (FileNotFoundError, ValueError, OSError):
            return Response({"detail": "The stored document file could not be read."}, status=400)

        media_type = credential_ocr.detect_media_type(data)
        if media_type is None:
            return Response({"detail": "The stored file isn't a PDF or a supported image."}, status=400)

        try:
            extracted = credential_ocr.extract_credential_fields(data, media_type)
        except credential_ocr.OcrUnavailable as exc:
            return Response({"detail": str(exc)}, status=503)
        except credential_ocr.OcrFailed as exc:
            return Response({"detail": str(exc)}, status=502)

        holder = credential.technician.user.get_full_name() or credential.technician.user.email
        credential.ai_check = {
            "checked_at": timezone.now().isoformat(),
            "model": settings.CREDENTIAL_OCR_MODEL,
            "extracted": extracted.model_dump(),
            "flags": credential_ocr.compare_extraction(extracted, credential, holder),
        }
        credential.save(update_fields=["ai_check"])
        AuditLog.record(request.user, "credential.ai_check", credential, flags=len(credential.ai_check["flags"]))
        return Response(CredentialSerializer(credential, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        # Admin-only by design: unlike capabilities, contractor managers don't
        # self-verify credentials — EPA/issuer-backed documents stay a human
        # admin review, same as the Django Admin actions this replaces.
        if not (request.user.role == "admin" or request.user.is_staff):
            raise PermissionDenied("Only admins can review credentials.")

        credential = self.get_object()
        new_status = request.data.get("status")
        if new_status not in CredentialStatus.values:
            return Response({"detail": "Invalid status."}, status=400)

        credential.status = new_status
        credential.notes = request.data.get("notes", credential.notes)
        credential.reviewed_by = request.user
        credential.reviewed_at = timezone.now()
        credential.save()
        AuditLog.record(request.user, f"credential.{new_status}", credential)
        Notification.notify(
            credential.technician.user, Notification.Kind.CREDENTIAL,
            f"Credential {credential.get_status_display().lower()}", credential.name, "/credentials",
        )
        return Response(CredentialSerializer(credential).data)


class CapabilitySkillViewSet(OwnTechnicianScopedMixin, viewsets.ModelViewSet):
    serializer_class = CapabilitySkillSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["technician", "capability_type", "status"]

    def queryset_base(self):
        return CapabilitySkill.objects.select_related("technician__user", "refrigerant_type").order_by("id")

    def perform_update(self, serializer):
        user = self.request.user
        technician = serializer.instance.technician
        if user.role != "technician" or technician.user_id != user.id:
            raise PermissionDenied("Only the technician can edit their declared capability.")
        serializer.save(
            technician=technician,
            status=CapabilityStatus.PENDING,
            verified_by=None,
            verified_at=None,
        )

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        skill = self.get_object()
        user = request.user
        can_verify = user.role == "admin" or user.is_staff or (
            user.role == "contractor_manager" and skill.technician.contractor_id
            and skill.technician.contractor.manager_id == user.id
        )
        if not can_verify:
            raise PermissionDenied("You are not authorized to verify this capability.")

        new_status = request.data.get("status")
        if new_status not in CapabilityStatus.values:
            return Response({"detail": "Invalid status."}, status=400)

        skill.status = new_status
        skill.note = request.data.get("note", skill.note)
        skill.verified_by = user
        skill.verified_at = timezone.now()
        skill.save()
        AuditLog.record(user, "capability.verify", skill, new_status=new_status)
        Notification.notify(
            skill.technician.user, Notification.Kind.CREDENTIAL,
            f"Capability {skill.get_status_display().lower()}", skill.note, "/capabilities",
        )
        return Response(CapabilitySkillSerializer(skill).data)


class WorkHistoryEntryViewSet(OwnTechnicianScopedMixin, viewsets.ModelViewSet):
    serializer_class = WorkHistoryEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["technician", "equipment_category"]

    def queryset_base(self):
        return WorkHistoryEntry.objects.select_related("technician__user").order_by("-date")
