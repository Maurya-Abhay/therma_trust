from rest_framework import serializers

from .models import Assessment, AssessmentAttempt, AssessmentQuestion


class AssessmentQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentQuestion
        # correct_index is deliberately excluded — never send the answer key to the client
        fields = ["id", "prompt", "choices", "order"]


class AssessmentSerializer(serializers.ModelSerializer):
    target_label = serializers.SerializerMethodField()
    refrigerant_type_code = serializers.CharField(source="refrigerant_type.code", read_only=True, default=None)
    questions = AssessmentQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Assessment
        fields = [
            "id", "title", "capability_type", "equipment_category", "refrigerant_type",
            "refrigerant_type_code", "safety_domain", "target_label", "pass_score_percent", "questions",
        ]

    def get_target_label(self, obj):
        return obj.target_label()


class AssessmentAttemptSerializer(serializers.ModelSerializer):
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)

    class Meta:
        model = AssessmentAttempt
        fields = ["id", "assessment", "assessment_title", "technician", "score_percent", "passed", "submitted_at"]
        read_only_fields = fields
