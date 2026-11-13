import pytest

from apps.accounts.models import User
from apps.technicians.models import TechnicianProfile


@pytest.mark.django_db
def test_me_endpoint_returns_own_profile_not_first_in_table(api_client, technician, contractor):
    """Regression test: when multiple technicians exist, /technicians/me/ must return
    the caller's own profile, not whichever technician happens to have the lowest id."""
    other_user = User.objects.create_user(
        username="other_tech", email="other_tech@test.local", password="pass12345", role=User.Role.TECHNICIAN
    )
    other_technician = TechnicianProfile.objects.create(user=other_user, contractor=contractor)
    assert other_technician.id != technician.id

    api_client.force_authenticate(user=technician.user)
    response = api_client.get("/api/technicians/me/")

    assert response.status_code == 200
    assert response.data["id"] == technician.id
    assert response.data["user"] == technician.user_id


@pytest.mark.django_db
def test_technician_can_update_own_profile_via_patch(api_client, technician):
    api_client.force_authenticate(user=technician.user)
    response = api_client.patch(
        f"/api/technicians/{technician.id}/",
        {"service_area": "Pune", "years_experience": 3, "bio": "updated bio"},
        format="json",
    )

    assert response.status_code == 200, response.data
    technician.refresh_from_db()
    assert technician.service_area == "Pune"
    assert technician.years_experience == 3
    assert technician.bio == "updated bio"


@pytest.mark.django_db
def test_technician_cannot_update_another_technicians_profile(api_client, technician, contractor):
    other_user = User.objects.create_user(
        username="other_tech2", email="other_tech2@test.local", password="pass12345", role=User.Role.TECHNICIAN
    )
    other_technician = TechnicianProfile.objects.create(user=other_user, contractor=contractor)

    api_client.force_authenticate(user=technician.user)
    response = api_client.patch(
        f"/api/technicians/{other_technician.id}/", {"bio": "hijacked"}, format="json"
    )

    assert response.status_code == 403
