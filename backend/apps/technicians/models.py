import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.choices import (
    CapabilityStatus,
    CapabilityType,
    CredentialStatus,
    EquipmentCategory,
    EvidenceType,
    SafetyDomain,
)


class TechnicianProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="technician_profile")
    contractor = models.ForeignKey(
        "contractors.ContractorCompany", on_delete=models.SET_NULL, null=True, blank=True, related_name="technicians"
    )
    service_area = models.CharField(max_length=120, blank=True)
    years_experience = models.PositiveIntegerField(default=0)
    available = models.BooleanField(default=True)
    bio = models.TextField(blank=True)
    public_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.email


class Credential(models.Model):
    technician = models.ForeignKey(TechnicianProfile, on_delete=models.CASCADE, related_name="credentials")
    name = models.CharField(max_length=200)
    issuer_name = models.CharField(max_length=200)
    credential_number = models.CharField(max_length=100, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to="credentials/")
    status = models.CharField(max_length=24, choices=CredentialStatus.choices, default=CredentialStatus.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    # Result of an admin-triggered AI read of the stored document: what it
    # extracted plus the mismatch flags. A second opinion, never an approval.
    ai_check = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def effective_status(self):
        if self.status == CredentialStatus.PLATFORM_VERIFIED and self.expiry_date and self.expiry_date < timezone.now().date():
            return CredentialStatus.EXPIRED
        return self.status

    def __str__(self):
        return f"{self.name} - {self.technician}"


class CapabilitySkill(models.Model):
    technician = models.ForeignKey(TechnicianProfile, on_delete=models.CASCADE, related_name="capabilities")
    capability_type = models.CharField(max_length=16, choices=CapabilityType.choices)
    # exactly one of these is set, depending on capability_type
    equipment_category = models.CharField(max_length=40, choices=EquipmentCategory.choices, blank=True)
    refrigerant_type = models.ForeignKey(
        "core.RefrigerantType", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    safety_domain = models.CharField(max_length=40, choices=SafetyDomain.choices, blank=True)

    evidence_type = models.CharField(max_length=32, choices=EvidenceType.choices, default=EvidenceType.NONE)
    status = models.CharField(max_length=16, choices=CapabilityStatus.choices, default=CapabilityStatus.PENDING)
    note = models.CharField(max_length=300, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technician", "capability_type", "equipment_category", "refrigerant_type", "safety_domain"],
                name="unique_capability_per_technician",
            )
        ]

    def label(self):
        if self.capability_type == CapabilityType.EQUIPMENT:
            return self.get_equipment_category_display()
        if self.capability_type == CapabilityType.REFRIGERANT:
            return self.refrigerant_type.code if self.refrigerant_type else "?"
        return self.get_safety_domain_display()

    def __str__(self):
        return f"{self.technician} - {self.label()} ({self.status})"


class WorkHistoryEntry(models.Model):
    technician = models.ForeignKey(TechnicianProfile, on_delete=models.CASCADE, related_name="work_history")
    equipment_category = models.CharField(max_length=40, choices=EquipmentCategory.choices)
    refrigerant_type = models.ForeignKey(
        "core.RefrigerantType", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    job = models.ForeignKey(
        "jobs.JobRequest", on_delete=models.SET_NULL, null=True, blank=True, related_name="work_history_entries"
    )
    description = models.CharField(max_length=300)
    date = models.DateField()

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.technician} - {self.get_equipment_category_display()} - {self.date}"
