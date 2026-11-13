from rest_framework import serializers

from apps.servicereports.services.drift import detect_drift

from .models import Equipment, Facility


class EquipmentSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    refrigerant_type_code = serializers.CharField(source="refrigerant_type.code", read_only=True)
    drift_warnings = serializers.SerializerMethodField()

    class Meta:
        model = Equipment
        fields = [
            "id", "facility", "name", "category", "category_display", "refrigerant_type",
            "refrigerant_type_code", "capacity", "refrigerant_charge_kg", "criticality",
            "install_date", "created_at", "drift_warnings",
        ]
        read_only_fields = ["id", "created_at"]

    def get_drift_warnings(self, obj):
        return detect_drift(obj)


class FacilitySerializer(serializers.ModelSerializer):
    equipment_count = serializers.IntegerField(source="equipment.count", read_only=True)

    class Meta:
        model = Facility
        fields = [
            "id", "owner", "name", "segment", "address", "service_area",
            "contact_name", "contact_phone", "equipment_count", "created_at",
        ]
        read_only_fields = ["id", "owner", "created_at"]
