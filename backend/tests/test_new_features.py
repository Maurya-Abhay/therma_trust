"""Password reset, job scheduling, feedback, notifications, search, onboarding,
report/label PDFs and the monthly dashboard series."""
import datetime
from decimal import Decimal

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.choices import CredentialStatus, JobStatus
from apps.core.models import Notification
from apps.jobs.models import JobAssignment, JobRequest
from apps.servicereports.models import ServiceReport
from apps.technicians.models import Credential

from .conftest import make_equipment


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def equipment(facility, refrigerants):
    unit = make_equipment(facility, refrigerants["R-134a"])
    unit.refrigerant_charge_kg = Decimal("40")
    unit.save()
    return unit


@pytest.fixture
def job(facility, equipment, facility_manager):
    return JobRequest.objects.create(
        facility=facility, equipment=equipment, created_by=facility_manager,
        description="Compressor tripping", risk_level="medium",
    )


@pytest.fixture
def assigned_job(job, technician, facility_manager):
    JobAssignment.objects.create(job=job, technician=technician, assigned_by=facility_manager)
    job.status = JobStatus.ASSIGNED
    job.save()
    return job


@pytest.fixture
def report(assigned_job, technician, refrigerants):
    return ServiceReport.objects.create(
        job=assigned_job, technician=technician, fault_description="Low charge",
        refrigerant_type=refrigerants["R-134a"], refrigerant_added_kg=Decimal("2.50"),
        refrigerant_recovered_kg=Decimal("0.50"), summary="Topped up and leak tested",
        leak_test_result="pass", technician_signed_at=timezone.now(),
    )


# ------------------------------------------------------------------ password reset
@pytest.mark.django_db
def test_reset_request_sends_email_with_link(facility_manager):
    response = APIClient().post("/api/auth/password-reset/", {"email": facility_manager.email}, format="json")
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert "/reset-password?uid=" in mail.outbox[0].body
    assert mail.outbox[0].to == [facility_manager.email]


@pytest.mark.django_db
def test_reset_request_does_not_reveal_unknown_emails():
    response = APIClient().post("/api/auth/password-reset/", {"email": "nobody@test.local"}, format="json")
    assert response.status_code == 200
    assert mail.outbox == []


@pytest.mark.django_db
def test_reset_confirm_changes_password(facility_manager):
    uid = urlsafe_base64_encode(force_bytes(facility_manager.pk))
    token = default_token_generator.make_token(facility_manager)
    response = APIClient().post(
        "/api/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "password": "brand-new-pass-9"},
        format="json",
    )
    assert response.status_code == 200
    facility_manager.refresh_from_db()
    assert facility_manager.check_password("brand-new-pass-9")
    # the same link cannot be used twice
    again = APIClient().post(
        "/api/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "password": "another-pass-77"},
        format="json",
    )
    assert again.status_code == 400


@pytest.mark.django_db
def test_reset_confirm_rejects_bad_token_and_weak_password(facility_manager):
    uid = urlsafe_base64_encode(force_bytes(facility_manager.pk))
    bad = APIClient().post(
        "/api/auth/password-reset/confirm/", {"uid": uid, "token": "nope", "password": "brand-new-pass-9"}, format="json"
    )
    assert bad.status_code == 400
    token = default_token_generator.make_token(facility_manager)
    weak = APIClient().post(
        "/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "password": "123"}, format="json"
    )
    assert weak.status_code == 400
    assert "password" in weak.json()


# ------------------------------------------------------------------ scheduling
@pytest.mark.django_db
def test_facility_manager_can_schedule_and_filter_jobs(job, facility_manager):
    when = (timezone.now() + datetime.timedelta(days=3)).replace(microsecond=0)
    client = client_for(facility_manager)
    response = client.patch(f"/api/jobs/{job.id}/", {"scheduled_for": when.isoformat()}, format="json")
    assert response.status_code == 200
    assert response.json()["scheduled_for"] is not None

    start = (when - datetime.timedelta(days=1)).isoformat()
    end = (when + datetime.timedelta(days=1)).isoformat()
    listed = client.get("/api/jobs/", {"scheduled_for__gte": start, "scheduled_for__lte": end}).json()
    rows = listed["results"] if isinstance(listed, dict) else listed
    assert [r["id"] for r in rows] == [job.id]

    outside = client.get("/api/jobs/", {"scheduled_for__gte": (when + datetime.timedelta(days=5)).isoformat()}).json()
    rows = outside["results"] if isinstance(outside, dict) else outside
    assert rows == []


@pytest.mark.django_db
def test_technician_cannot_edit_a_job(assigned_job, technician):
    response = client_for(technician.user).patch(
        f"/api/jobs/{assigned_job.id}/", {"description": "changed"}, format="json"
    )
    assert response.status_code == 403


# ------------------------------------------------------------------ feedback
@pytest.mark.django_db
def test_feedback_requires_completed_job(assigned_job, facility_manager):
    response = client_for(facility_manager).post(
        f"/api/jobs/{assigned_job.id}/feedback/", {"rating": 5}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_feedback_is_saved_once_and_shown_on_technician(assigned_job, technician, facility_manager):
    assigned_job.status = JobStatus.COMPLETED
    assigned_job.save()
    client = client_for(facility_manager)

    created = client.post(
        f"/api/jobs/{assigned_job.id}/feedback/", {"rating": 4, "comment": "On time, tidy work"}, format="json"
    )
    assert created.status_code == 201
    assert created.json()["rating"] == 4

    duplicate = client.post(f"/api/jobs/{assigned_job.id}/feedback/", {"rating": 5}, format="json")
    assert duplicate.status_code == 409

    job_payload = client.get(f"/api/jobs/{assigned_job.id}/").json()
    assert job_payload["feedback"]["rating"] == 4

    profile = client_for(technician.user).get("/api/technicians/me/").json()
    assert profile["average_rating"] == 4.0
    assert profile["rating_count"] == 1
    assert Notification.objects.filter(user=technician.user, kind="feedback").exists()


@pytest.mark.django_db
def test_feedback_rating_must_be_one_to_five(assigned_job, facility_manager):
    assigned_job.status = JobStatus.COMPLETED
    assigned_job.save()
    response = client_for(facility_manager).post(
        f"/api/jobs/{assigned_job.id}/feedback/", {"rating": 9}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_only_the_owner_can_rate(assigned_job, technician):
    assigned_job.status = JobStatus.COMPLETED
    assigned_job.save()
    response = client_for(technician.user).post(
        f"/api/jobs/{assigned_job.id}/feedback/", {"rating": 5}, format="json"
    )
    assert response.status_code == 403


# ------------------------------------------------------------------ notifications
@pytest.mark.django_db
def test_assigning_a_job_notifies_the_technician(job, technician, facility_manager, refrigerants):
    response = client_for(facility_manager).post(
        f"/api/jobs/{job.id}/assign/", {"technician_id": technician.id}, format="json"
    )
    assert response.status_code == 201
    note = Notification.objects.get(user=technician.user)
    assert note.kind == "job"
    assert note.link == f"/my-jobs/{job.id}/report"


@pytest.mark.django_db
def test_credential_review_notifies_the_technician(technician, admin_user):
    credential = Credential.objects.create(
        technician=technician, name="EPA 608", issuer_name="EPA", file="credentials/x.pdf",
    )
    response = client_for(admin_user).post(
        f"/api/credentials/{credential.id}/verify/", {"status": CredentialStatus.PLATFORM_VERIFIED}, format="json"
    )
    assert response.status_code == 200
    assert Notification.objects.filter(user=technician.user, kind="credential").count() == 1


@pytest.mark.django_db
def test_report_approval_notifies_the_technician(report, facility_manager, technician):
    response = client_for(facility_manager).post(f"/api/service-reports/{report.id}/approve/")
    assert response.status_code == 200
    assert Notification.objects.filter(user=technician.user, kind="report").count() == 1


@pytest.mark.django_db
def test_notifications_list_and_mark_read(technician):
    Notification.notify(technician.user, "info", "One")
    other = Notification.notify(technician.user, "info", "Two")
    client = client_for(technician.user)

    data = client.get("/api/notifications/").json()
    assert data["unread_count"] == 2
    assert [n["title"] for n in data["results"]] == ["Two", "One"]

    assert client.post("/api/notifications/read/", {"ids": [other.id]}, format="json").json()["updated"] == 1
    assert client.get("/api/notifications/").json()["unread_count"] == 1
    assert client.post("/api/notifications/read/", {"all": True}, format="json").json()["updated"] == 1
    assert client.get("/api/notifications/").json()["unread_count"] == 0


@pytest.mark.django_db
def test_notifications_are_private(technician, facility_manager):
    Notification.notify(technician.user, "info", "Private")
    data = client_for(facility_manager).get("/api/notifications/").json()
    assert data["results"] == []
    assert data["unread_count"] == 0


# ------------------------------------------------------------------ search
@pytest.mark.django_db
def test_search_is_scoped_to_the_caller(facility, equipment, job, facility_manager, technician):
    client = client_for(facility_manager)
    found = client.get("/api/search/", {"q": "Test Facility"}).json()["results"]
    assert any(r["type"] == "facility" and r["link"] == f"/facilities/{facility.id}" for r in found)

    by_equipment = client.get("/api/search/", {"q": "chiller"}).json()["results"]
    assert any(r["type"] == "equipment" and r["link"] == f"/equipment/{equipment.id}" for r in by_equipment)

    # a technician with no assignments sees none of the facility's records
    assert client_for(technician.user).get("/api/search/", {"q": "Test Facility"}).json()["results"] == []


@pytest.mark.django_db
def test_search_needs_two_characters(facility_manager, facility):
    assert client_for(facility_manager).get("/api/search/", {"q": "T"}).json()["results"] == []


# ------------------------------------------------------------------ onboarding
@pytest.mark.django_db
def test_onboarding_reflects_real_progress(facility_manager, facility, equipment, job):
    data = client_for(facility_manager).get("/api/onboarding/").json()
    done = {s["id"]: s["done"] for s in data["steps"]}
    assert done == {"facility": True, "equipment": True, "job": True, "complete": False}
    assert data["completed"] == 3
    assert data["total"] == 4


@pytest.mark.django_db
def test_onboarding_for_a_new_technician(technician):
    data = client_for(technician.user).get("/api/onboarding/").json()
    done = {s["id"]: s["done"] for s in data["steps"]}
    assert done["profile"] is True  # fixture sets service area and experience
    assert done["credential"] is False
    assert data["total"] == 5


@pytest.mark.django_db
def test_onboarding_is_empty_for_admin(admin_user):
    assert client_for(admin_user).get("/api/onboarding/").json() == {"steps": [], "completed": 0, "total": 0}


# ------------------------------------------------------------------ PDFs
@pytest.mark.django_db
def test_service_report_pdf_for_the_owning_facility(report, facility_manager):
    response = client_for(facility_manager).get(f"/api/service-reports/{report.id}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


@pytest.mark.django_db
def test_service_report_pdf_is_scoped(report, technician):
    other = User.objects.create_user(
        username="fm2", email="fm2@test.local", password="pass12345", role=User.Role.FACILITY_MANAGER
    )
    assert client_for(other).get(f"/api/service-reports/{report.id}/pdf/").status_code == 404
    assert client_for(technician.user).get(f"/api/service-reports/{report.id}/pdf/").status_code == 200


@pytest.mark.django_db
def test_equipment_label_pdf(equipment, facility_manager):
    response = client_for(facility_manager).get(f"/api/equipment/{equipment.id}/label/")
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")


@pytest.mark.django_db
def test_equipment_history_lists_jobs_and_reports(report, equipment, facility_manager):
    data = client_for(facility_manager).get(f"/api/equipment/{equipment.id}/history/").json()
    assert data["equipment"]["id"] == equipment.id
    assert data["leak_rate"]["added_kg_12mo"] == 2.5
    assert [j["id"] for j in data["jobs"]] == [report.job_id]
    assert data["reports"][0]["refrigerant_added_kg"] == 2.5


# ------------------------------------------------------------------ dashboard series
@pytest.mark.django_db
def test_dashboard_has_twelve_months_of_series(report, facility_manager):
    data = client_for(facility_manager).get("/api/dashboard/refrigerant-summary/").json()
    monthly = data["monthly"]
    assert len(monthly) == 12
    current = timezone.now().strftime("%Y-%m")
    assert monthly[-1]["month"] == current
    assert monthly[-1]["added_kg"] == 2.5
    assert monthly[-1]["recovered_kg"] == 0.5
    assert all(m["added_kg"] == 0 for m in monthly[:-1])
