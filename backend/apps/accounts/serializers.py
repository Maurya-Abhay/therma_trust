from django.db import transaction
from rest_framework import serializers

from .models import User


def normalise_email(value: str) -> str:
    """Emails are matched case-insensitively by people (phone keyboards capitalise the first
    letter), so they are stored lowercase and compared that way."""
    return value.strip().lower()


def ensure_email_free(email: str, exclude_id=None) -> None:
    taken = User.objects.filter(email__iexact=email)
    if exclude_id is not None:
        taken = taken.exclude(pk=exclude_id)
    if taken.exists():
        raise serializers.ValidationError("A user with this email already exists.")


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "role"]
        read_only_fields = ["id", "role"]

    def validate_email(self, value):
        email = normalise_email(value)
        ensure_email_free(email, exclude_id=self.instance.pk if self.instance else None)
        return email


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(
        choices=[
            (User.Role.FACILITY_MANAGER, User.Role.FACILITY_MANAGER.label),
            (User.Role.TECHNICIAN, User.Role.TECHNICIAN.label),
            (User.Role.CONTRACTOR_MANAGER, User.Role.CONTRACTOR_MANAGER.label),
        ]
    )

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name", "phone", "role"]

    def validate_email(self, value):
        email = normalise_email(value)
        ensure_email_free(email)
        return email

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        if user.role == User.Role.TECHNICIAN:
            from apps.technicians.models import TechnicianProfile

            TechnicianProfile.objects.create(user=user)

        return user
