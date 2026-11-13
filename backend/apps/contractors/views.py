from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.choices import CapabilityStatus, ContractorVerificationStatus
from apps.core.models import AuditLog
from apps.technicians.models import CapabilitySkill, TechnicianProfile
from apps.technicians.serializers import TechnicianProfileSerializer

from .models import ContractorCompany, ContractorDocument
from .serializers import ContractorCompanySerializer, ContractorDocumentSerializer
from .services.compliance import compute_compliance


def _require_admin(user):
    if not (user.role == "admin" or user.is_staff):
        raise PermissionDenied("Admin only.")


class ContractorCompanyViewSet(viewsets.ModelViewSet):
    serializer_class = ContractorCompanySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["verification_status"]

    def get_queryset(self):
        user = self.request.user
        qs = ContractorCompany.objects.all().order_by("-created_at")
        if user.role == "contractor_manager":
            return qs.filter(manager=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        if self.request.user.role != "contractor_manager":
            raise PermissionDenied("Only contractor managers can create contractor companies.")
        serializer.save(manager=self.request.user)

    def _check_manages(self, company):
        if self.request.user.role == "contractor_manager" and company.manager_id != self.request.user.id:
            raise PermissionDenied("You do not manage this contractor company.")

    @action(detail=True, methods=["get"])
    def technicians(self, request, pk=None):
        company = self.get_object()
        qs = TechnicianProfile.objects.filter(contractor=company).select_related("user")
        return Response(TechnicianProfileSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"])
    def compliance(self, request, pk=None):
        company = self.get_object()
        return Response(compute_compliance(company))

    @action(detail=True, methods=["get"], url_path="pending-approvals")
    def pending_approvals(self, request, pk=None):
        company = self.get_object()
        count = CapabilitySkill.objects.filter(
            technician__contractor=company, status=CapabilityStatus.PENDING
        ).count()
        return Response({"pending_capabilities": count})

    @action(detail=True, methods=["post"], url_path="add-technician")
    def add_technician(self, request, pk=None):
        company = self.get_object()
        self._check_manages(company)
        technician_id = request.data.get("technician_id")
        try:
            technician = TechnicianProfile.objects.get(pk=technician_id)
        except TechnicianProfile.DoesNotExist:
            return Response({"detail": "Technician not found."}, status=status.HTTP_404_NOT_FOUND)
        technician.contractor = company
        technician.save(update_fields=["contractor"])
        return Response(TechnicianProfileSerializer(technician).data)

    @action(detail=True, methods=["post"], url_path="remove-technician")
    def remove_technician(self, request, pk=None):
        company = self.get_object()
        self._check_manages(company)
        technician_id = request.data.get("technician_id")
        TechnicianProfile.objects.filter(pk=technician_id, contractor=company).update(contractor=None)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        _require_admin(request.user)
        company = self.get_object()
        new_status = request.data.get("verification_status")
        if new_status not in ContractorVerificationStatus.values:
            return Response({"detail": "Invalid status."}, status=400)

        company.verification_status = new_status
        company.save(update_fields=["verification_status"])
        AuditLog.record(request.user, f"contractor.{new_status}", company)
        return Response(ContractorCompanySerializer(company).data)


class ContractorDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ContractorDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["company", "doc_type", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = ContractorDocument.objects.select_related("company").order_by("-uploaded_at")
        if user.role == "contractor_manager":
            return qs.filter(company__manager=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data["company"]
        if user.role != "contractor_manager" and not (user.role == "admin" or user.is_staff):
            raise PermissionDenied("Only a contractor manager or admin can upload company documents.")
        if user.role == "contractor_manager" and company.manager_id != user.id:
            raise PermissionDenied("You do not manage this contractor company.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        _require_admin(request.user)
        document = self.get_object()
        new_status = request.data.get("status")
        if new_status not in ContractorDocument.Status.values:
            return Response({"detail": "Invalid status."}, status=400)

        document.status = new_status
        document.save(update_fields=["status"])
        AuditLog.record(request.user, f"contractor_document.{new_status}", document)
        return Response(ContractorDocumentSerializer(document).data)
