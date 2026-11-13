from rest_framework import serializers

from apps.servicereports.services.drift import detect_drift

from .models import JobAssignment, JobFeedback, JobRequest


class JobAssignmentSerializer(serializers.ModelSerializer):
    technician_name = serializers.SerializerMethodField()

    class Meta:
        model = JobAssignment
        fields = [
            "id", "job", "technician", "technician_name", "assigned_by",
            "override_warning", "override_reason", "assigned_at",
        ]
        read_only_fields = fields

    def get_technician_name(self, obj):
        return obj.technician.user.get_full_name() or obj.technician.user.email


class JobFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobFeedback
        fields = ["id", "job", "rating", "comment", "created_at"]
        read_only_fields = ["id", "job", "created_at"]


class JobRequestSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    facility_name = serializers.CharField(source="facility.name", read_only=True)
    assignment = JobAssignmentSerializer(read_only=True)
    equipment_drift_warnings = serializers.SerializerMethodField()
    feedback = serializers.SerializerMethodField()

    class Meta:
        model = JobRequest
        fields = [
            "id", "facility", "facility_name", "equipment", "equipment_name", "created_by",
            "description", "urgency", "status", "risk_level", "required_capabilities",
            "assignment", "created_at", "equipment_drift_warnings", "scheduled_for", "feedback",
        ]
        read_only_fields = ["id", "created_by", "status", "risk_level", "required_capabilities", "created_at"]

    def get_feedback(self, obj):
        feedback = getattr(obj, "feedback", None)
        return JobFeedbackSerializer(feedback).data if feedback else None

    def get_equipment_drift_warnings(self, obj):
        return detect_drift(obj.equipment)
