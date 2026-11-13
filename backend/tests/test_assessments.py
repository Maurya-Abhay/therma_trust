import pytest

from apps.assessments.models import Assessment, AssessmentQuestion
from apps.core.choices import CapabilityStatus, CapabilityType, EvidenceType, SafetyDomain
from apps.technicians.models import CapabilitySkill


@pytest.fixture
def ammonia_assessment(db):
    assessment = Assessment.objects.create(
        title="Ammonia Safety Fundamentals",
        capability_type=CapabilityType.SAFETY,
        safety_domain=SafetyDomain.AMMONIA_SAFETY,
        pass_score_percent=75,
    )
    AssessmentQuestion.objects.create(
        assessment=assessment, prompt="Q1", choices=["a", "b"], correct_index=0, order=0
    )
    AssessmentQuestion.objects.create(
        assessment=assessment, prompt="Q2", choices=["a", "b"], correct_index=1, order=1
    )
    AssessmentQuestion.objects.create(
        assessment=assessment, prompt="Q3", choices=["a", "b"], correct_index=0, order=2
    )
    AssessmentQuestion.objects.create(
        assessment=assessment, prompt="Q4", choices=["a", "b"], correct_index=1, order=3
    )
    return assessment


@pytest.mark.django_db
def test_assessment_list_never_exposes_correct_index(api_client, technician, ammonia_assessment):
    api_client.force_authenticate(user=technician.user)
    response = api_client.get("/api/assessments/")
    assert response.status_code == 200
    question = response.data["results"][0]["questions"][0]
    assert "correct_index" not in question


@pytest.mark.django_db
def test_passing_assessment_auto_verifies_capability(api_client, technician, ammonia_assessment):
    api_client.force_authenticate(user=technician.user)
    # 3 of 4 correct = 75%, meets the 75% pass bar
    response = api_client.post(
        f"/api/assessments/{ammonia_assessment.id}/submit/",
        {"answers": [0, 1, 0, 0]},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["score_percent"] == 75
    assert response.data["passed"] is True
    assert response.data["capability_status"] == CapabilityStatus.VERIFIED

    skill = CapabilitySkill.objects.get(technician=technician, safety_domain=SafetyDomain.AMMONIA_SAFETY)
    assert skill.status == CapabilityStatus.VERIFIED
    assert skill.evidence_type == EvidenceType.PRACTICAL_ASSESSMENT


@pytest.mark.django_db
def test_failing_assessment_does_not_create_capability(api_client, technician, ammonia_assessment):
    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        f"/api/assessments/{ammonia_assessment.id}/submit/",
        {"answers": [1, 0, 1, 0]},  # 1 of 4 correct = 25%
        format="json",
    )
    assert response.status_code == 201
    assert response.data["passed"] is False
    assert response.data["capability_status"] is None
    assert not CapabilitySkill.objects.filter(technician=technician, safety_domain=SafetyDomain.AMMONIA_SAFETY).exists()


@pytest.mark.django_db
def test_submit_rejects_wrong_answer_count(api_client, technician, ammonia_assessment):
    api_client.force_authenticate(user=technician.user)
    response = api_client.post(
        f"/api/assessments/{ammonia_assessment.id}/submit/", {"answers": [0, 1]}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_non_technician_cannot_submit(api_client, facility_manager, ammonia_assessment):
    api_client.force_authenticate(user=facility_manager)
    response = api_client.post(
        f"/api/assessments/{ammonia_assessment.id}/submit/", {"answers": [0, 1, 0, 1]}, format="json"
    )
    assert response.status_code == 403
