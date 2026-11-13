from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.core.upload_validation import validate_image_upload

from .models import CylinderTransaction, RefrigerantCylinder, ServiceReport, ServiceReportPhoto
from .services.cylinders import validate_cylinder_use

CYLINDER_FIELDS = ("added_from_cylinder", "recovered_into_cylinder")
AMOUNT_LOCKED_FIELDS = ("refrigerant_added_kg", "refrigerant_recovered_kg", "refrigerant_type")


class ServiceReportPhotoSerializer(serializers.ModelSerializer):
    def validate_image(self, value):
        validate_image_upload(value)
        return value

    class Meta:
        model = ServiceReportPhoto
        fields = ["id", "report", "image", "caption", "is_before"]
        read_only_fields = ["id"]


class ServiceReportSerializer(serializers.ModelSerializer):
    photos = ServiceReportPhotoSerializer(many=True, read_only=True)
    technician_name = serializers.SerializerMethodField()
    refrigerant_code = serializers.CharField(source="refrigerant_type.code", read_only=True)
    added_from_cylinder_serial = serializers.CharField(
        source="added_from_cylinder.serial_number", read_only=True, default=None
    )
    recovered_into_cylinder_serial = serializers.CharField(
        source="recovered_into_cylinder.serial_number", read_only=True, default=None
    )

    class Meta:
        model = ServiceReport
        fields = [
            "id", "job", "technician", "technician_name", "fault_description", "diagnostic_readings",
            "refrigerant_type", "refrigerant_code", "refrigerant_added_kg", "refrigerant_recovered_kg",
            "added_from_cylinder", "added_from_cylinder_serial",
            "recovered_into_cylinder", "recovered_into_cylinder_serial",
            "leak_test_result", "vacuum_result", "parts_replaced", "safety_checklist", "summary",
            "status", "technician_signed_at", "facility_approved_by", "facility_approved_at",
            "photos", "created_at",
        ]
        read_only_fields = [
            "id", "technician", "status", "technician_signed_at", "facility_approved_by",
            "facility_approved_at", "created_at",
        ]

    def get_technician_name(self, obj):
        return obj.technician.user.get_full_name() or obj.technician.user.email

    def validate(self, attrs):
        if self.instance is not None:
            return self._validate_update(attrs)

        used = {f: attrs[f] for f in CYLINDER_FIELDS if attrs.get(f) is not None}
        if not used:
            return attrs

        request = self.context.get("request")
        technician = getattr(request.user, "technician_profile", None) if request else None
        if technician is None:
            raise serializers.ValidationError("Only technicians can log refrigerant against a cylinder.")

        refrigerant_type = attrs["refrigerant_type"]
        if "added_from_cylinder" in used:
            validate_cylinder_use(
                used["added_from_cylinder"], field="added_from_cylinder",
                kind=RefrigerantCylinder.Kind.SUPPLY, refrigerant_type=refrigerant_type,
                kg=attrs.get("refrigerant_added_kg", Decimal("0")), technician=technician,
            )
        if "recovered_into_cylinder" in used:
            validate_cylinder_use(
                used["recovered_into_cylinder"], field="recovered_into_cylinder",
                kind=RefrigerantCylinder.Kind.RECOVERY, refrigerant_type=refrigerant_type,
                kg=attrs.get("refrigerant_recovered_kg", Decimal("0")), technician=technician,
            )
        return attrs

    def _validate_update(self, attrs):
        # Cylinder balances were already moved when the report was submitted,
        # so letting these change afterwards would silently desync the ledger.
        for field in CYLINDER_FIELDS:
            if field in attrs and attrs[field] != getattr(self.instance, field):
                raise serializers.ValidationError(
                    {field: "Cylinders can only be chosen when the report is first submitted."}
                )
        if self.instance.added_from_cylinder_id or self.instance.recovered_into_cylinder_id:
            for field in AMOUNT_LOCKED_FIELDS:
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    raise serializers.ValidationError(
                        {field: "This can't be changed once refrigerant was logged against a cylinder."}
                    )
        return attrs


class RefrigerantCylinderSerializer(serializers.ModelSerializer):
    refrigerant_type_code = serializers.CharField(source="refrigerant_type.code", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = RefrigerantCylinder
        fields = [
            "id", "company", "company_name", "serial_number", "refrigerant_type", "refrigerant_type_code",
            "kind", "capacity_kg", "current_kg", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        capacity = attrs["capacity_kg"]
        current = attrs.get("current_kg", Decimal("0"))
        if capacity <= 0:
            raise serializers.ValidationError({"capacity_kg": "Capacity must be greater than 0."})
        if current < 0:
            raise serializers.ValidationError({"current_kg": "Starting amount can't be negative."})
        if current > capacity:
            raise serializers.ValidationError({"current_kg": "Starting amount can't exceed the cylinder's capacity."})
        return attrs


class CylinderTransactionSerializer(serializers.ModelSerializer):
    job = serializers.IntegerField(source="service_report.job_id", read_only=True, default=None)
    technician_name = serializers.SerializerMethodField()

    class Meta:
        model = CylinderTransaction
        fields = ["id", "kind", "amount_kg", "balance_after_kg", "service_report", "job", "technician_name", "created_at"]

    def get_technician_name(self, obj):
        if obj.service_report is None:
            return None
        user = obj.service_report.technician.user
        return user.get_full_name() or user.email
