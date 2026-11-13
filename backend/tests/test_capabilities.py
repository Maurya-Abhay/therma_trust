import pytest

from apps.core.choices import CapabilityType, EvidenceType, SafetyDomain


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload_extra",
    [
        {"capability_type": CapabilityType.EQUIPMENT, "equipment_category": "commercial_chiller"},
        {"capability_type": CapabilityType.SAFETY, "safety_domain": SafetyDomain.LEAK_DETECTION},
    ],
)
def test_declare_capability_without_the_other_two_fields_succeeds(api_client, technician, payload_extra):
    """Regression test: a model UniqueConstraint spanning equipment_category/refrigerant_type/
    safety_domain must not force all three to be DRF-required — only one is ever set per row."""
    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        "/api/capabilities/",
        {"technician": technician.id, "evidence_type": EvidenceType.NONE, **payload_extra},
        format="json",
    )
    assert response.status_code == 201, response.data


@pytest.mark.django_db
def test_declare_refrigerant_capability_succeeds(api_client, technician, refrigerants):
    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        "/api/capabilities/",
        {
            "technician": technician.id, "capability_type": CapabilityType.REFRIGERANT,
            "refrigerant_type": refrigerants["R-134a"].id, "evidence_type": EvidenceType.NONE,
        },
        format="json",
    )
    assert response.status_code == 201, response.data


@pytest.mark.django_db
def test_declaring_same_capability_twice_is_rejected_cleanly(api_client, technician):
    api_client.force_authenticate(user=technician.user)
    payload = {
        "technician": technician.id, "capability_type": CapabilityType.EQUIPMENT,
        "equipment_category": "commercial_chiller", "evidence_type": EvidenceType.NONE,
    }
    first = api_client.post("/api/capabilities/", payload, format="json")
    assert first.status_code == 201

    second = api_client.post("/api/capabilities/", payload, format="json")
    assert second.status_code == 400


@pytest.mark.django_db
def test_declare_capability_missing_required_field_gives_clean_400(api_client, technician):
    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        "/api/capabilities/",
        {"technician": technician.id, "capability_type": CapabilityType.EQUIPMENT, "evidence_type": EvidenceType.NONE},
        format="json",
    )
    assert response.status_code == 400
    assert "equipment_category" in response.data
