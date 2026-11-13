from django.conf import settings
from django.db import models

from apps.core.choices import ContractorVerificationStatus


class ContractorCompany(models.Model):
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="contractor_companies"
    )
    name = models.CharField(max_length=200)
    registration_number = models.CharField(max_length=100, blank=True)
    service_area = models.CharField(max_length=120, help_text="City/zone used for technician matching")
    response_time_commitment = models.CharField(max_length=100, blank=True, help_text="e.g. 4 hours")
    verification_status = models.CharField(
        max_length=16, choices=ContractorVerificationStatus.choices, default=ContractorVerificationStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ContractorDocument(models.Model):
    class DocType(models.TextChoices):
        BUSINESS_REGISTRATION = "business_registration", "Business Registration"
        INSURANCE = "insurance", "Insurance"
        SAFETY_POLICY = "safety_policy", "Safety Policy"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    company = models.ForeignKey(ContractorCompany, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=32, choices=DocType.choices)
    file = models.FileField(upload_to="contractor_documents/")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company.name} - {self.get_doc_type_display()}"
