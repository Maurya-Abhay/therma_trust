from django.conf import settings
from django.db import models

from apps.core.choices import JobStatus, RiskLevel, Urgency


class JobRequest(models.Model):
    facility = models.ForeignKey("facilities.Facility", on_delete=models.CASCADE, related_name="jobs")
    equipment = models.ForeignKey("facilities.Equipment", on_delete=models.CASCADE, related_name="jobs")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="jobs_created")
    description = models.TextField()
    urgency = models.CharField(max_length=16, choices=Urgency.choices, default=Urgency.SCHEDULED)
    status = models.CharField(max_length=16, choices=JobStatus.choices, default=JobStatus.OPEN)

    # computed at creation time by apps.jobs.services.risk, cached for display/matching
    risk_level = models.CharField(max_length=16, choices=RiskLevel.choices, blank=True)
    required_capabilities = models.JSONField(default=list, blank=True)

    scheduled_for = models.DateTimeField(
        null=True, blank=True, db_index=True, help_text="When the work is planned to happen (drives the calendar).",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Job #{self.pk} - {self.equipment} ({self.risk_level})"


class JobAssignment(models.Model):
    job = models.OneToOneField(JobRequest, on_delete=models.CASCADE, related_name="assignment")
    technician = models.ForeignKey(
        "technicians.TechnicianProfile", on_delete=models.CASCADE, related_name="assignments"
    )
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    override_warning = models.BooleanField(default=False)
    override_reason = models.CharField(max_length=300, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Job #{self.job_id} -> {self.technician}"


class JobFeedback(models.Model):
    """The facility manager's rating of a completed job (one per job)."""

    job = models.OneToOneField(JobRequest, on_delete=models.CASCADE, related_name="feedback")
    rating = models.PositiveSmallIntegerField(help_text="1 (poor) to 5 (excellent)")
    comment = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Job #{self.job_id}: {self.rating}/5"
