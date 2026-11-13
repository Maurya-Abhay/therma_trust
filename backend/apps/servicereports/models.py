from django.conf import settings
from django.db import models

from apps.core.choices import ReportStatus


class ServiceReport(models.Model):
    job = models.OneToOneField("jobs.JobRequest", on_delete=models.CASCADE, related_name="service_report")
    technician = models.ForeignKey(
        "technicians.TechnicianProfile", on_delete=models.CASCADE, related_name="service_reports"
    )

    fault_description = models.TextField()
    diagnostic_readings = models.JSONField(
        default=dict, blank=True,
        help_text="e.g. suction/discharge pressure, superheat, subcooling, amps",
    )

    refrigerant_type = models.ForeignKey("core.RefrigerantType", on_delete=models.PROTECT, related_name="+")
    refrigerant_added_kg = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    refrigerant_recovered_kg = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    added_from_cylinder = models.ForeignKey(
        "servicereports.RefrigerantCylinder", null=True, blank=True, on_delete=models.PROTECT, related_name="+",
        help_text="Supply cylinder the added refrigerant was drawn from (chain of custody).",
    )
    recovered_into_cylinder = models.ForeignKey(
        "servicereports.RefrigerantCylinder", null=True, blank=True, on_delete=models.PROTECT, related_name="+",
        help_text="Recovery cylinder the recovered refrigerant was put into (chain of custody).",
    )

    leak_test_result = models.CharField(max_length=20, blank=True, help_text="pass / fail / not_applicable")
    vacuum_result = models.CharField(max_length=20, blank=True, help_text="pass / fail / not_applicable")
    parts_replaced = models.TextField(blank=True)
    safety_checklist = models.JSONField(default=dict, blank=True)
    summary = models.TextField(blank=True)

    status = models.CharField(max_length=16, choices=ReportStatus.choices, default=ReportStatus.SUBMITTED)
    technician_signed_at = models.DateTimeField(null=True, blank=True)
    facility_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    facility_approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report for Job #{self.job_id}"


class ServiceReportPhoto(models.Model):
    report = models.ForeignKey(ServiceReport, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="service_report_photos/")
    caption = models.CharField(max_length=200, blank=True)
    is_before = models.BooleanField(default=True)

    def __str__(self):
        return f"Photo for report #{self.report_id}"


class RefrigerantCylinder(models.Model):
    """A physical refrigerant cylinder owned by a contractor company.

    Supply cylinders hold new refrigerant that gets charged into equipment;
    recovery cylinders only ever receive gas pulled out of equipment. Keeping
    the two separate (and one refrigerant type per cylinder) mirrors real
    recovery practice, where mixing refrigerants contaminates a cylinder.
    """

    class Kind(models.TextChoices):
        SUPPLY = "supply", "Supply (new refrigerant)"
        RECOVERY = "recovery", "Recovery (recovered refrigerant)"

    company = models.ForeignKey("contractors.ContractorCompany", on_delete=models.CASCADE, related_name="cylinders")
    serial_number = models.CharField(max_length=64)
    refrigerant_type = models.ForeignKey("core.RefrigerantType", on_delete=models.PROTECT, related_name="+")
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.SUPPLY)
    capacity_kg = models.DecimalField(max_digits=8, decimal_places=2)
    current_kg = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["serial_number"]
        constraints = [
            models.UniqueConstraint(fields=["company", "serial_number"], name="unique_cylinder_serial_per_company"),
        ]

    def __str__(self):
        return f"{self.serial_number} ({self.refrigerant_type_id and self.refrigerant_type.code})"


class CylinderTransaction(models.Model):
    """Append-only ledger line: every kg in or out of a cylinder is recorded."""

    class Kind(models.TextChoices):
        INITIAL_FILL = "initial_fill", "Initial fill"
        DRAW = "draw", "Drawn for a service job"
        RECOVERY = "recovery", "Recovered from a service job"

    cylinder = models.ForeignKey(RefrigerantCylinder, on_delete=models.CASCADE, related_name="transactions")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount_kg = models.DecimalField(max_digits=8, decimal_places=2)
    balance_after_kg = models.DecimalField(max_digits=8, decimal_places=2)
    service_report = models.ForeignKey(
        ServiceReport, null=True, blank=True, on_delete=models.SET_NULL, related_name="cylinder_transactions"
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.kind} {self.amount_kg}kg on {self.cylinder}"
