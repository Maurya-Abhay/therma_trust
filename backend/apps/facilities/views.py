from django.http import HttpResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Equipment, Facility
from .serializers import EquipmentSerializer, FacilitySerializer
from .services.labels import render_equipment_label_pdf
from .services.leak_rate import compute_leak_rate


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = obj.owner if hasattr(obj, "owner") else obj.facility.owner
        return owner_id_matches(owner, request.user)


def owner_id_matches(owner, user):
    return owner_id(owner) == user.id


def owner_id(owner):
    return owner.id if hasattr(owner, "id") else owner


class FacilityViewSet(viewsets.ModelViewSet):
    serializer_class = FacilitySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    filterset_fields = ["segment"]

    def get_queryset(self):
        user = self.request.user
        qs = Facility.objects.all().order_by("-created_at")
        if user.role == "facility_manager":
            return qs.filter(owner=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        if self.request.user.role != "facility_manager":
            raise PermissionDenied("Only facility managers can create facilities.")
        serializer.save(owner=self.request.user)


class EquipmentViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["facility", "category", "criticality"]

    def get_queryset(self):
        user = self.request.user
        qs = Equipment.objects.select_related("facility", "refrigerant_type").order_by("-created_at")
        if user.role == "facility_manager":
            return qs.filter(facility__owner=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        facility = serializer.validated_data["facility"]
        if user.role != "facility_manager" and not (user.role == "admin" or user.is_staff):
            raise PermissionDenied("Only facility managers and admins can create equipment.")
        if user.role == "facility_manager" and facility.owner_id != user.id:
            raise PermissionDenied("You do not own this facility.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def label(self, request, pk=None):
        equipment = self.get_object()
        response = HttpResponse(render_equipment_label_pdf(equipment), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="equipment-label-{equipment.id}.pdf"'
        return response

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Everything known about one unit: its specs, leak rate and the
        jobs and reports raised against it."""
        equipment = self.get_object()
        jobs = equipment.jobs.select_related("assignment__technician__user").order_by("-created_at")[:50]
        reports = []
        for job in jobs:
            report = getattr(job, "service_report", None)
            if report is None:
                continue
            reports.append(
                {
                    "id": report.id,
                    "job": job.id,
                    "created_at": report.created_at,
                    "status": report.status,
                    "refrigerant_added_kg": float(report.refrigerant_added_kg),
                    "refrigerant_recovered_kg": float(report.refrigerant_recovered_kg),
                    "summary": report.summary,
                    "technician": report.technician.user.get_full_name() or report.technician.user.email,
                }
            )
        return Response(
            {
                "equipment": EquipmentSerializer(equipment).data,
                "facility_name": equipment.facility.name,
                "leak_rate": compute_leak_rate(equipment),
                "jobs": [
                    {
                        "id": j.id, "status": j.status, "risk_level": j.risk_level, "urgency": j.urgency,
                        "description": j.description, "created_at": j.created_at, "scheduled_for": j.scheduled_for,
                    }
                    for j in jobs
                ],
                "reports": reports,
            }
        )
