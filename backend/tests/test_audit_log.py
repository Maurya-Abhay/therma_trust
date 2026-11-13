import pytest

from apps.core.models import AuditLog


@pytest.mark.django_db
def test_chain_is_valid_after_normal_writes(admin_user, facility):
    AuditLog.record(admin_user, "facility.create", facility)
    AuditLog.record(admin_user, "facility.update", facility, field="name")
    AuditLog.record(admin_user, "facility.update", facility, field="address")

    is_valid, broken_at_id = AuditLog.verify_chain()

    assert is_valid
    assert broken_at_id is None


@pytest.mark.django_db
def test_each_entry_links_to_the_previous_entry_hash(admin_user, facility):
    first = AuditLog.record(admin_user, "facility.create", facility)
    second = AuditLog.record(admin_user, "facility.update", facility)

    assert first.prev_hash == ""
    assert first.entry_hash != ""
    assert second.prev_hash == first.entry_hash
    assert second.entry_hash != first.entry_hash


@pytest.mark.django_db
def test_tampering_with_a_past_entry_breaks_the_chain(admin_user, facility):
    AuditLog.record(admin_user, "facility.create", facility)
    tampered = AuditLog.record(admin_user, "facility.update", facility)
    AuditLog.record(admin_user, "facility.update", facility)

    # Simulate someone editing a row directly (e.g. via shell/DB), bypassing
    # the read-only admin and the model's own save() hashing.
    AuditLog.objects.filter(pk=tampered.pk).update(action="facility.delete")

    is_valid, broken_at_id = AuditLog.verify_chain()

    assert not is_valid
    assert broken_at_id == tampered.id


@pytest.mark.django_db
def test_deleting_a_past_entry_breaks_the_chain(admin_user, facility):
    first = AuditLog.record(admin_user, "facility.create", facility)
    second = AuditLog.record(admin_user, "facility.update", facility)

    first.delete()

    is_valid, broken_at_id = AuditLog.verify_chain()

    assert not is_valid
    assert broken_at_id == second.id


@pytest.mark.django_db
def test_verify_endpoint_reachable_by_admin(api_client, admin_user, facility):
    AuditLog.record(admin_user, "facility.create", facility)
    api_client.force_authenticate(user=admin_user)

    response = api_client.get("/api/audit/verify/")

    assert response.status_code == 200
    assert response.data == {"valid": True, "broken_at_id": None, "checked_count": 1}


@pytest.mark.django_db
def test_verify_endpoint_reports_tampering(api_client, admin_user, facility):
    entry = AuditLog.record(admin_user, "facility.create", facility)
    AuditLog.objects.filter(pk=entry.pk).update(object_id="9999")
    api_client.force_authenticate(user=admin_user)

    response = api_client.get("/api/audit/verify/")

    assert response.status_code == 200
    assert response.data["valid"] is False
    assert response.data["broken_at_id"] == entry.id


@pytest.mark.django_db
def test_verify_endpoint_blocked_for_non_admin(api_client, facility_manager):
    api_client.force_authenticate(user=facility_manager)

    response = api_client.get("/api/audit/verify/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_empty_log_verifies_as_valid():
    is_valid, broken_at_id = AuditLog.verify_chain()

    assert is_valid
    assert broken_at_id is None
