from django.utils import timezone
from rest_framework import serializers

from apps.core.choices import CapabilityType
from apps.core.upload_validation import validate_document_upload

from .models import CapabilitySkill, Credential, TechnicianProfile, WorkHistoryEntry


class TechnicianProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    contractor_name = serializers.CharField(source="contractor.name", read_only=True, default=None)
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()

    class Meta:
        model = TechnicianProfile
        fields = [
            "id", "user", "email", "full_name", "contractor", "contractor_name",
            "service_area", "years_experience", "available", "bio", "public_token",
            "average_rating", "rating_count",
        ]
        read_only_fields = ["id", "user", "public_token"]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def _rating_stats(self, obj):
        from django.db.models import Avg, Count

        from apps.jobs.models import JobFeedback

        return JobFeedback.objects.filter(job__assignment__technician=obj).aggregate(
            avg=Avg("rating"), count=Count("id")
        )

    def get_average_rating(self, obj):
        avg = self._rating_stats(obj)["avg"]
        return round(float(avg), 2) if avg is not None else None

    def get_rating_count(self, obj):
        return self._rating_stats(obj)["count"]


class CredentialSerializer(serializers.ModelSerializer):
    effective_status = serializers.CharField(read_only=True)
    technician_name = serializers.SerializerMethodField()

    class Meta:
        model = Credential
        fields = [
            "id", "technician", "technician_name", "name", "issuer_name", "credential_number", "issue_date",
            "expiry_date", "file", "status", "effective_status", "reviewed_by", "reviewed_at",
            "notes", "ai_check", "created_at",
        ]
        read_only_fields = ["id", "status", "reviewed_by", "reviewed_at", "ai_check", "created_at"]

    def validate_file(self, value):
        validate_document_upload(value)
        return value

    def get_technician_name(self, obj):
        return obj.technician.user.get_full_name() or obj.technician.user.email

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # The AI check is an admin's review aid; showing a technician exactly
        # which fields tripped a flag would only teach them to tune around it.
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and (user.role == "admin" or user.is_staff)):
            data.pop("ai_check", None)
        return data


class CapabilitySkillSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()
    technician_name = serializers.SerializerMethodField()
    refrigerant_type_code = serializers.CharField(source="refrigerant_type.code", read_only=True, default=None)

    class Meta:
        model = CapabilitySkill
        fields = [
            "id", "technician", "technician_name", "capability_type", "equipment_category", "refrigerant_type",
            "refrigerant_type_code", "safety_domain", "evidence_type", "status", "note",
            "label", "verified_by", "verified_at",
        ]
        read_only_fields = ["id", "status", "verified_by", "verified_at"]
        # The model's UniqueConstraint spans equipment_category/refrigerant_type/safety_domain,
        # of which only one is ever set per row. DRF's auto-generated UniqueTogetherValidator
        # would force all three to be "required" (overriding blank=True) if left enabled, so
        # it's disabled here and uniqueness is enforced explicitly in validate() instead.
        validators = []

    def get_label(self, obj):
        return obj.label()

    def get_technician_name(self, obj):
        return obj.technician.user.get_full_name() or obj.technician.user.email

    def validate(self, attrs):
        capability_type = attrs.get("capability_type", getattr(self.instance, "capability_type", None))
        equipment_category = attrs.get("equipment_category", getattr(self.instance, "equipment_category", ""))
        refrigerant_type = attrs.get("refrigerant_type", getattr(self.instance, "refrigerant_type", None))
        safety_domain = attrs.get("safety_domain", getattr(self.instance, "safety_domain", ""))
        technician = attrs.get("technician", getattr(self.instance, "technician", None))

        if capability_type == CapabilityType.EQUIPMENT and not equipment_category:
            raise serializers.ValidationError({"equipment_category": "Required for equipment capabilities."})
        if capability_type == CapabilityType.REFRIGERANT and not refrigerant_type:
            raise serializers.ValidationError({"refrigerant_type": "Required for refrigerant capabilities."})
        if capability_type == CapabilityType.SAFETY and not safety_domain:
            raise serializers.ValidationError({"safety_domain": "Required for safety capabilities."})

        if technician is not None:
            duplicate_qs = CapabilitySkill.objects.filter(
                technician=technician, capability_type=capability_type,
                equipment_category=equipment_category or "",
                refrigerant_type=refrigerant_type,
                safety_domain=safety_domain or "",
            )
            if self.instance is not None:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError("This capability has already been declared for this technician.")
        return attrs


class WorkHistoryEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkHistoryEntry
        fields = ["id", "technician", "equipment_category", "refrigerant_type", "job", "description", "date"]
        read_only_fields = ["id"]
