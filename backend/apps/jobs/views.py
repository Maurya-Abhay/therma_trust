from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.choices import JobStatus, RiskLevel
from apps.core.models import AuditLog, Notification
from apps.technicians.models import TechnicianProfile

from .models import JobAssignment, JobFeedback, JobRequest
from .serializers import JobAssignmentSerializer, JobFeedbackSerializer, JobRequestSerializer
from .services import matching
from .services.risk import classify

HIGH_RISK_LEVELS = (RiskLevel.HIGH, RiskLevel.VERY_HIGH, RiskLevel.CRITICAL)


class JobRequestViewSet(viewsets.ModelViewSet):
    serializer_class = JobRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = {
        "facility": ["exact"],
        "equipment": ["exact"],
        "status": ["exact"],
        "risk_level": ["exact"],
        "scheduled_for": ["gte", "lte"],
    }

    def get_queryset(self):
        user = self.request.user
        qs = JobRequest.objects.select_related("facility", "equipment", "assignment", "feedback").order_by("-created_at")
        if user.role == "facility_manager":
            return qs.filter(facility__owner=user)
        if user.role == "technician":
            return qs.filter(assignment__technician__user=user)
        if user.role == "contractor_manager":
            return qs.filter(assignment__technician__contractor__manager=user)
        if user.role == "admin" or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        if self.request.user.role != "facility_manager":
            raise PermissionDenied("Only facility managers can create job requests.")
        equipment = serializer.validated_data["equipment"]
        urgency = serializer.validated_data.get("urgency", "scheduled")
        risk_level, required_capabilities, _breakdown = classify(equipment, urgency)
        serializer.save(
            created_by=self.request.user,
            risk_level=risk_level,
            required_capabilities=required_capabilities,
        )

    def perform_update(self, serializer):
        # Description, urgency and schedule belong to the facility that raised
        # the job; assigned technicians and contractors only read it.
        user = self.request.user
        if not (user.role == "facility_manager" or user.role == "admin" or user.is_staff):
            raise PermissionDenied("Only the facility manager can change a job request.")
        serializer.save()

    @action(detail=True, methods=["get", "post"])
    def feedback(self, request, pk=None):
        job = self.get_object()
        if request.method == "GET":
            existing = getattr(job, "feedback", None)
            return Response(JobFeedbackSerializer(existing).data if existing else None)

        if request.user.role != "facility_manager" or job.facility.owner_id != request.user.id:
            raise PermissionDenied("Only the facility manager who raised this job can rate it.")
        if job.status != JobStatus.COMPLETED:
            return Response({"detail": "A job can only be rated once it is completed."}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(job, "feedback", None) is not None:
            return Response({"detail": "This job has already been rated."}, status=status.HTTP_409_CONFLICT)

        serializer = JobFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = serializer.validated_data["rating"]
        if not 1 <= rating <= 5:
            return Response({"rating": ["Rating must be between 1 and 5."]}, status=status.HTTP_400_BAD_REQUEST)

        feedback = serializer.save(job=job, created_by=request.user)
        AuditLog.record(request.user, "job.feedback", job, rating=rating)
        assignment = getattr(job, "assignment", None)
        if assignment:
            Notification.notify(
                assignment.technician.user, Notification.Kind.FEEDBACK,
                f"You were rated {rating}/5", job.equipment.name, "/my-jobs",
            )
        return Response(JobFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def matches(self, request, pk=None):
        job = self.get_object()
        results = matching.rank_technicians(job)
        payload = [
            {
                "technician_id": r["technician"].id,
                "name": r["technician"].user.get_full_name() or r["technician"].user.email,
                "contractor": r["technician"].contractor.name if r["technician"].contractor else None,
                "score": r["score"],
                "breakdown": r["breakdown"],
                "missing_requirements": r["missing_requirements"],
                "is_qualified": r["is_qualified"],
            }
            for r in results
        ]
        return Response(payload)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        job = self.get_object()
        if job.status not in (JobStatus.OPEN,):
            return Response({"detail": "Job is not open for assignment."}, status=status.HTTP_400_BAD_REQUEST)

        technician_id = request.data.get("technician_id")
        try:
            technician = TechnicianProfile.objects.get(pk=technician_id)
        except TechnicianProfile.DoesNotExist:
            return Response({"detail": "Technician not found."}, status=status.HTTP_404_NOT_FOUND)

        override_warning = bool(request.data.get("override_warning", False))
        override_reason = request.data.get("override_reason", "")

        result = matching.score_technician(technician, job)
        is_high_risk = job.risk_level in HIGH_RISK_LEVELS

        if is_high_risk and not result["is_qualified"]:
            if not override_warning:
                return Response(
                    {
                        "detail": "Technician is missing required verified capabilities for a high-risk job.",
                        "missing_requirements": result["missing_requirements"],
                        "requires_override": True,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if not override_reason:
                return Response(
                    {"detail": "override_reason is required when overriding a capability warning."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        assignment = JobAssignment.objects.create(
            job=job,
            technician=technician,
            assigned_by=request.user,
            override_warning=is_high_risk and not result["is_qualified"],
            override_reason=override_reason if (is_high_risk and not result["is_qualified"]) else "",
        )
        job.status = JobStatus.ASSIGNED
        job.save(update_fields=["status"])

        AuditLog.record(
            request.user,
            "job.assign",
            job,
            technician_id=technician.id,
            override_warning=assignment.override_warning,
            override_reason=assignment.override_reason,
        )
        Notification.notify(
            technician.user, Notification.Kind.JOB, "New job assigned",
            f"{job.equipment.name} at {job.facility.name}", f"/my-jobs/{job.id}/report",
        )
        return Response(JobAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)
