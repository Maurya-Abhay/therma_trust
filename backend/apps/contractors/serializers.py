from rest_framework import serializers

from apps.core.upload_validation import validate_document_upload

from .models import ContractorCompany, ContractorDocument


class ContractorDocumentSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    def validate_file(self, value):
        validate_document_upload(value)
        return value

    class Meta:
        model = ContractorDocument
        fields = ["id", "company", "company_name", "doc_type", "file", "status", "uploaded_at"]
        read_only_fields = ["id", "status", "uploaded_at"]


class ContractorCompanySerializer(serializers.ModelSerializer):
    technician_count = serializers.IntegerField(source="technicians.count", read_only=True)

    class Meta:
        model = ContractorCompany
        fields = [
            "id", "manager", "name", "registration_number", "service_area",
            "response_time_commitment", "verification_status", "technician_count", "created_at",
        ]
        read_only_fields = ["id", "manager", "verification_status", "created_at"]
