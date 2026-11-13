from django.conf import settings
from django.db import models

from apps.core.choices import EquipmentCategory, Criticality


class Facility(models.Model):
    class Segment(models.TextChoices):
        COLD_STORAGE = "cold_storage", "Cold Storage"
        SUPERMARKET_REFRIGERATION = "supermarket_refrigeration", "Supermarket Refrigeration"
        OTHER = "other", "Other"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="facilities")
    name = models.CharField(max_length=200)
    segment = models.CharField(max_length=32, choices=Segment.choices, default=Segment.COLD_STORAGE)
    address = models.CharField(max_length=300)
    service_area = models.CharField(max_length=120, help_text="City/zone used for technician matching")
    contact_name = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Equipment(models.Model):
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="equipment")
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=40, choices=EquipmentCategory.choices)
    refrigerant_type = models.ForeignKey(
        "core.RefrigerantType", on_delete=models.PROTECT, related_name="equipment"
    )
    capacity = models.CharField(max_length=100, blank=True, help_text="e.g. 50 TR, 200 kW")
    refrigerant_charge_kg = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
        help_text="Full system refrigerant charge in kg — the denominator for EPA-style leak-rate tracking.",
    )
    criticality = models.CharField(max_length=16, choices=Criticality.choices, default=Criticality.MEDIUM)
    install_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"
