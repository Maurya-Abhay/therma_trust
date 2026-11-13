import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_is_public_and_reports_ok():
    response = APIClient().get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_health_ignores_a_bad_token():
    # A stale or garbage token must not turn a liveness ping into a 401.
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    assert client.get("/api/health/").status_code == 200
