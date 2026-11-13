from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.choices import CapabilityStatus, EvidenceType
from apps.technicians.models import CapabilitySkill, TechnicianProfile

from .models import Assessment, AssessmentAttempt
from .serializers import AssessmentAttemptSerializer, AssessmentSerializer


class AssessmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AssessmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["capability_type"]

    def get_queryset(self):
        return (
            Assessment.objects.filter(is_active=True)
            .select_related("refrigerant_type")
            .prefetch_related("questions")
            .order_by("id")
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        assessment = self.get_object()
        technician = TechnicianProfile.objects.filter(user=request.user).first()
        if technician is None:
            raise PermissionDenied("Only technicians can take assessments.")

        answers = request.data.get("answers")
        questions = list(assessment.questions.all())
        if not isinstance(answers, list) or len(answers) != len(questions):
            return Response(
                {"detail": f"Expected {len(questions)} answers, got {len(answers) if isinstance(answers, list) else 0}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        correct = sum(1 for q, a in zip(questions, answers) if a == q.correct_index)
        score_percent = round((correct / len(questions)) * 100) if questions else 0
        passed = score_percent >= assessment.pass_score_percent

        attempt = AssessmentAttempt.objects.create(
            assessment=assessment,
            technician=technician,
            answers=answers,
            score_percent=score_percent,
            passed=passed,
        )

        capability_status = None
        if passed:
            skill, _ = CapabilitySkill.objects.update_or_create(
                technician=technician,
                capability_type=assessment.capability_type,
                equipment_category=assessment.equipment_category or "",
                refrigerant_type=assessment.refrigerant_type,
                safety_domain=assessment.safety_domain or "",
                defaults={
                    "evidence_type": EvidenceType.PRACTICAL_ASSESSMENT,
                    "status": CapabilityStatus.VERIFIED,
                    "verified_by": None,
                    "verified_at": timezone.now(),
                    "note": f"Auto-verified by passing '{assessment.title}' ({score_percent}%).",
                },
            )
            capability_status = skill.status

        data = AssessmentAttemptSerializer(attempt).data
        data["capability_status"] = capability_status
        return Response(data, status=status.HTTP_201_CREATED)
