import csv

from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.choices import JobStatus, ReportStatus
from apps.core.models import AuditLog, Notification
from apps.facilities.services.leak_rate import compute_leak_rate

from .models import CylinderTransaction, RefrigerantCylinder, ServiceReport, ServiceReportPhoto
from .serializers import (
    CylinderTransactionSerializer,
    RefrigerantCylinderSerializer,
    ServiceReportPhotoSerializer,
    ServiceReportSerializer,
)
from .services.cylinders import apply_cylinder_movements
from .services.report_pdf import render_service_report_pdf


def _scoped_service_reports(request):
    qs = ServiceReport.objects.select_related("refrigerant_type", "job__equipment__facility")
    user = request.user
    if user.role == "facility_manager":
        qs = qs.filter(job__facility__owner=user)
    elif user.role == "contractor_manager":
        qs = qs.filter(technician__contractor__manager=user)
    elif user.role == "technician":
        qs = qs.filter(technician__user=user)
    elif user.role != "admin" and not user.is_staff:
        return qs.none()

    facility_id = request.query_params.get("facility")
    if facility_id:
        qs = qs.filter(job__facility_id=facility_id)
    return qs


def _monthly_series(qs, months=12):
    """Refrigerant added/recovered per calendar month for the last `months`
    months (oldest first, empty months included so a chart has no gaps)."""
    from collections import defaultdict
    from datetime import date

    today = timezone.now().date()
    keys = []
    year, month = today.year, today.month
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    keys.reverse()

    added = defaultdict(float)
    recovered = defaultdict(float)
    first = date(int(keys[0][:4]), int(keys[0][5:]), 1)
    for created_at, add, rec in qs.filter(created_at__date__gte=first).values_list(
        "created_at", "refrigerant_added_kg", "refrigerant_recovered_kg"
    ):
        key = f"{created_at.year:04d}-{created_at.month:02d}"
        added[key] += float(add)
        recovered[key] += float(rec)
    return [{"month": k, "added_kg": round(added[k], 2), "recovered_kg": round(recovered[k], 2)} for k in keys]


def _leak_rate_rows(request):
    """Equipment in scope for this user, derived from their visible service
    reports — reuses the dashboard's own role-based filtering instead of
    re-deriving "which equipment can this user see" from scratch."""
    from apps.facilities.models import Equipment

    qs = _scoped_service_reports(request)
    equipment_ids = qs.values_list("job__equipment_id", flat=True).distinct()
    equipment = Equipment.objects.filter(id__in=equipment_ids).select_related("facility")
    return [
        {**compute_leak_rate(eq), "facility_name": eq.facility.name}
        for eq in equipment
    ]


class ServiceReportViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["job", "technician", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = ServiceReport.objects.select_related(
            "job__facility", "technician__user", "refrigerant_type"
        ).order_by("-created_at")
        if user.role == "technician":
            return qs.filter(technician__user=user)
        if user.role == "facility_manager":
            return qs.filter(job__facility__owner=user)
        if user.role == "contractor_manager":
            return qs.filter(technician__contractor__manager=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "technician":
            raise PermissionDenied("Only technicians can submit service reports.")
        technician = getattr(user, "technician_profile", None)
        if technician is None:
            raise PermissionDenied("No technician profile found for this account.")

        job = serializer.validated_data["job"]
        assignment = getattr(job, "assignment", None)
        if not assignment or assignment.technician_id != technician.id:
            raise PermissionDenied("You are not assigned to this job.")

        # One transaction so a cylinder that turns out to be short/locked
        # elsewhere rolls the whole submission back instead of leaving a
        # report whose refrigerant never actually left a cylinder.
        with transaction.atomic():
            report = serializer.save(technician=technician, technician_signed_at=timezone.now())
            apply_cylinder_movements(report, user)
            job.status = JobStatus.IN_PROGRESS
            job.save(update_fields=["status"])

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        report = self.get_object()
        if request.user.role != "facility_manager" or report.job.facility.owner_id != request.user.id:
            raise PermissionDenied("Only the owning facility manager can approve this report.")

        report.status = ReportStatus.APPROVED
        report.facility_approved_by = request.user
        report.facility_approved_at = timezone.now()
        report.save()

        report.job.status = JobStatus.COMPLETED
        report.job.save(update_fields=["status"])
        Notification.notify(
            report.technician.user, Notification.Kind.REPORT, "Report approved",
            report.job.equipment.name, f"/my-jobs/{report.job_id}/report",
        )
        return Response(ServiceReportSerializer(report).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        report = self.get_object()
        if request.user.role != "facility_manager" or report.job.facility.owner_id != request.user.id:
            raise PermissionDenied("Only the owning facility manager can reject this report.")

        report.status = ReportStatus.REJECTED
        report.facility_approved_by = request.user
        report.facility_approved_at = timezone.now()
        report.save()
        Notification.notify(
            report.technician.user, Notification.Kind.REPORT, "Report needs changes",
            report.job.equipment.name, f"/my-jobs/{report.job_id}/report",
        )
        return Response(ServiceReportSerializer(report).data)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        report = self.get_object()
        response = HttpResponse(render_service_report_pdf(report), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="service-report-job-{report.job_id}.pdf"'
        return response


class ServiceReportPhotoViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceReportPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["report"]

    def get_queryset(self):
        user = self.request.user
        qs = ServiceReportPhoto.objects.select_related("report__technician__user", "report__job__facility")
        if user.role == "technician":
            return qs.filter(report__technician__user=user)
        if user.role == "facility_manager":
            return qs.filter(report__job__facility__owner=user)
        if user.role == "contractor_manager":
            return qs.filter(report__technician__contractor__manager=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        report = serializer.validated_data["report"]
        user = self.request.user
        technician = getattr(user, "technician_profile", None)
        if user.role != "technician" or not technician or report.technician_id != technician.id:
            raise PermissionDenied("You can only attach photos to your own service reports.")
        serializer.save()


class CylinderViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Cylinders are ledger-like: registered once, then only moved by service
    reports. No update/delete here, so balances can't be edited behind the
    ledger's back."""

    serializer_class = RefrigerantCylinderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["company", "kind", "refrigerant_type"]

    def get_queryset(self):
        user = self.request.user
        qs = RefrigerantCylinder.objects.select_related("company", "refrigerant_type")
        if user.role == "contractor_manager":
            return qs.filter(company__manager=user)
        if user.role == "technician":
            technician = getattr(user, "technician_profile", None)
            if technician is None or technician.contractor_id is None:
                return qs.none()
            return qs.filter(company_id=technician.contractor_id)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data["company"]
        if user.role != "contractor_manager" or company.manager_id != user.id:
            raise PermissionDenied("Only the managing contractor can register cylinders for this company.")

        with transaction.atomic():
            cylinder = serializer.save()
            if cylinder.current_kg > 0:
                CylinderTransaction.objects.create(
                    cylinder=cylinder, kind=CylinderTransaction.Kind.INITIAL_FILL, amount_kg=cylinder.current_kg,
                    balance_after_kg=cylinder.current_kg, created_by=user,
                )
            AuditLog.record(user, "cylinder.register", cylinder, kg=str(cylinder.current_kg))

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        cylinder = self.get_object()
        transactions = cylinder.transactions.select_related("service_report__technician__user")
        return Response(CylinderTransactionSerializer(transactions, many=True).data)


class RefrigerantDashboardView(APIView):
    """Aggregated refrigerant handling stats. Estimates only, not lab-confirmed."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = _scoped_service_reports(request)

        totals = qs.aggregate(
            total_added=Sum("refrigerant_added_kg"),
            total_recovered=Sum("refrigerant_recovered_kg"),
        )
        total_added = totals["total_added"] or 0
        total_recovered = totals["total_recovered"] or 0
        leaked_estimate_kg = max(total_added - total_recovered, 0)

        co2e_estimate = 0
        by_refrigerant = {}
        for report in qs:
            leaked = max(report.refrigerant_added_kg - report.refrigerant_recovered_kg, 0)
            gwp = report.refrigerant_type.gwp
            co2e_estimate += float(leaked) * gwp
            code = report.refrigerant_type.code
            entry = by_refrigerant.setdefault(code, {"added_kg": 0, "recovered_kg": 0, "leaked_estimate_kg": 0})
            entry["added_kg"] += float(report.refrigerant_added_kg)
            entry["recovered_kg"] += float(report.refrigerant_recovered_kg)
            entry["leaked_estimate_kg"] += float(leaked)

        return Response(
            {
                "is_estimate": True,
                "note": "Leak and CO2e figures are calculated as added-minus-recovered; not independently lab-confirmed.",
                "total_added_kg": total_added,
                "total_recovered_kg": total_recovered,
                "leaked_estimate_kg": leaked_estimate_kg,
                "co2e_estimate_kg": round(co2e_estimate, 2),
                "by_refrigerant": by_refrigerant,
                "report_count": qs.count(),
                "monthly": _monthly_series(qs),
                "leak_rate_by_equipment": _leak_rate_rows(request),
            }
        )


class RefrigerantComplianceExportView(APIView):
    """CSV export of the same per-equipment leak-rate breakdown as the
    dashboard, scoped to the same role-based visibility rules."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = _leak_rate_rows(request)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="refrigerant-compliance.csv"'
        writer = csv.writer(response)
        writer.writerow([
            "Equipment", "Facility", "Charge (kg)", "Added in last 12mo (kg)",
            "Leak Rate %", "Threshold %", "Exceeds Threshold", "Note",
        ])
        for row in rows:
            writer.writerow([
                row["equipment_name"], row["facility_name"], row["charge_kg"], row["added_kg_12mo"],
                row["leak_rate_percent"], row["threshold_percent"], row["exceeds_threshold"], row["note"] or "",
            ])
        return response
