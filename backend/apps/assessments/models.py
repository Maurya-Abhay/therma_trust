from django.db import models

from apps.core.choices import CapabilityType, EquipmentCategory, SafetyDomain


class Assessment(models.Model):
    """A short scored test that stands in for practical, on-the-job proof of a capability.

    Passing auto-verifies the matching CapabilitySkill with evidence_type=PRACTICAL_ASSESSMENT
    instead of requiring a human verifier — the score itself is the evidence.
    """

    title = models.CharField(max_length=200)
    capability_type = models.CharField(max_length=16, choices=CapabilityType.choices)
    # exactly one of these is set, matching the same pattern as CapabilitySkill
    equipment_category = models.CharField(max_length=40, choices=EquipmentCategory.choices, blank=True)
    refrigerant_type = models.ForeignKey(
        "core.RefrigerantType", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    safety_domain = models.CharField(max_length=40, choices=SafetyDomain.choices, blank=True)
    pass_score_percent = models.PositiveIntegerField(default=80)
    is_active = models.BooleanField(default=True)

    def target_label(self):
        if self.capability_type == CapabilityType.EQUIPMENT:
            return self.get_equipment_category_display()
        if self.capability_type == CapabilityType.REFRIGERANT:
            return self.refrigerant_type.code if self.refrigerant_type else "?"
        return self.get_safety_domain_display()

    def __str__(self):
        return self.title


class AssessmentQuestion(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="questions")
    prompt = models.TextField()
    choices = models.JSONField(help_text="List of answer choice strings, in display order")
    correct_index = models.PositiveSmallIntegerField(help_text="Index into choices; never exposed to the API")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.prompt[:60]


class AssessmentAttempt(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="attempts")
    technician = models.ForeignKey(
        "technicians.TechnicianProfile", on_delete=models.CASCADE, related_name="assessment_attempts"
    )
    answers = models.JSONField(help_text="List of chosen indices, one per question, in question order")
    score_percent = models.PositiveIntegerField()
    passed = models.BooleanField()
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.technician} - {self.assessment} - {self.score_percent}%"
