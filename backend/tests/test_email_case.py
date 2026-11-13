"""Email addresses are matched case-insensitively at registration, sign-in and profile edits."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User

PASSWORD = "StrongPass123"


def register(email, role="facility_manager", password=PASSWORD):
    return APIClient().post(
        "/api/auth/register/",
        {"email": email, "password": password, "first_name": "T", "last_name": "U", "role": role},
        format="json",
    )


def login(email, password=PASSWORD):
    return APIClient().post("/api/auth/login/", {"email": email, "password": password}, format="json")


@pytest.mark.django_db
def test_registration_stores_email_lowercase_and_trimmed():
    response = register("  Afrah.Shaikh@Example.COM ")
    assert response.status_code == 201
    assert User.objects.get().email == "afrah.shaikh@example.com"


@pytest.mark.django_db
@pytest.mark.parametrize("typed", ["afrah@example.com", "Afrah@Example.com", "AFRAH@EXAMPLE.COM", " afrah@example.com "])
def test_sign_in_works_whatever_the_case(typed):
    register("Afrah@Example.com")
    response = login(typed)
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "afrah@example.com"


@pytest.mark.django_db
def test_account_stored_with_capitals_can_still_sign_in():
    """Accounts created before normalisation may have mixed-case emails in the database."""
    User.objects.create_user(username="Legacy@Example.com", email="Legacy@Example.com", password=PASSWORD, role="technician")
    assert login("legacy@example.com").status_code == 200
    assert login("Legacy@Example.com").status_code == 200
    assert login("LEGACY@example.com").status_code == 200


@pytest.mark.django_db
def test_wrong_password_still_fails_whatever_the_case():
    register("sam@example.com")
    assert login("Sam@Example.com", "wrong-password").status_code == 401


@pytest.mark.django_db
def test_unknown_email_fails():
    assert login("nobody@example.com").status_code == 401


@pytest.mark.django_db
def test_inactive_account_cannot_sign_in():
    register("gone@example.com")
    User.objects.filter(email="gone@example.com").update(is_active=False)
    assert login("Gone@Example.com").status_code == 401


@pytest.mark.django_db
def test_same_email_in_a_different_case_is_rejected_at_registration():
    assert register("dup@example.com").status_code == 201
    response = register("DUP@example.com")
    assert response.status_code == 400
    assert "email" in response.json()
    assert User.objects.count() == 1


@pytest.mark.django_db
def test_rejected_when_a_legacy_mixed_case_account_exists():
    User.objects.create_user(username="Old@Example.com", email="Old@Example.com", password=PASSWORD, role="technician")
    assert register("old@example.com").status_code == 400


@pytest.mark.django_db
def test_exact_case_match_wins_when_legacy_duplicates_exist():
    """Before this fix two accounts could differ only by case; each must still reach its own."""
    User.objects.create_user(username="Twin@Example.com", email="Twin@Example.com", password="FirstPass123", role="technician")
    User.objects.create_user(username="twin@example.com", email="twin@example.com", password="SecondPass123", role="facility_manager")

    first = login("Twin@Example.com", "FirstPass123")
    second = login("twin@example.com", "SecondPass123")
    assert first.status_code == 200 and first.json()["user"]["role"] == "technician"
    assert second.status_code == 200 and second.json()["user"]["role"] == "facility_manager"


@pytest.mark.django_db
def test_profile_email_edit_is_normalised_and_cannot_collide():
    register("me@example.com")
    register("other@example.com")
    me = User.objects.get(email="me@example.com")
    client = APIClient()
    client.force_authenticate(me)

    collision = client.patch("/api/auth/me/", {"email": "Other@Example.com"}, format="json")
    assert collision.status_code == 400

    changed = client.patch("/api/auth/me/", {"email": "New.Me@Example.com"}, format="json")
    assert changed.status_code == 200
    me.refresh_from_db()
    assert me.email == "new.me@example.com"

    # Re-saving one's own address in another case is not a collision with oneself.
    again = client.patch("/api/auth/me/", {"email": "NEW.ME@example.com"}, format="json")
    assert again.status_code == 200
