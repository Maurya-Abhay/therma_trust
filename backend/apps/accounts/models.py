from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        FACILITY_MANAGER = "facility_manager", "Facility Manager"
        TECHNICIAN = "technician", "Technician"
        CONTRACTOR_MANAGER = "contractor_manager", "Contractor Manager"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=Role.choices)
    phone = models.CharField(max_length=32, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.role})"
