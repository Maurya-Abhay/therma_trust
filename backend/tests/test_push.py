"""Browser push alerts: subscription API and best-effort delivery."""
import json
from unittest import mock

import pytest
from django.test import override_settings
from pywebpush import WebPushException
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.models import Notification, PushSubscription
from apps.core.services import push

KEYS = {"p256dh": "BP-public-key-material", "auth": "auth-secret"}
ENDPOINT = "https://push.example.test/send/abc123"
SETTINGS = dict(VAPID_PUBLIC_KEY="pub", VAPID_PRIVATE_KEY="priv", PUSH_SEND_ASYNC=False)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def user(db):
    return User.objects.create_user(username="pushy", email="pushy@test.local", password="pass12345", role=User.Role.TECHNICIAN)


@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="other", email="other@test.local", password="pass12345", role=User.Role.FACILITY_MANAGER)


def subscribe(user, endpoint=ENDPOINT):
    return client_for(user).post(
        "/api/notifications/push/subscribe/", {"endpoint": endpoint, "keys": KEYS}, format="json"
    )


# ---------------------------------------------------------------- key endpoint
def test_key_endpoint_requires_login(api_client):
    assert api_client.get("/api/notifications/push/key/").status_code == 401


@override_settings(VAPID_PUBLIC_KEY="", VAPID_PRIVATE_KEY="")
def test_key_endpoint_reports_disabled_without_keys(user):
    data = client_for(user).get("/api/notifications/push/key/").json()
    assert data == {"enabled": False, "public_key": ""}


@override_settings(VAPID_PUBLIC_KEY="pub", VAPID_PRIVATE_KEY="priv")
def test_key_endpoint_serves_public_key_only(user):
    data = client_for(user).get("/api/notifications/push/key/").json()
    assert data == {"enabled": True, "public_key": "pub"}
    assert "priv" not in json.dumps(data)


# ---------------------------------------------------------------- subscriptions
def test_subscribe_stores_subscription(user):
    response = subscribe(user)
    assert response.status_code == 201
    sub = PushSubscription.objects.get()
    assert (sub.user, sub.endpoint, sub.p256dh, sub.auth) == (user, ENDPOINT, KEYS["p256dh"], KEYS["auth"])


def test_subscribe_is_idempotent_per_endpoint(user):
    subscribe(user)
    subscribe(user)
    assert PushSubscription.objects.count() == 1


def test_subscribe_moves_endpoint_to_latest_user(user, other_user):
    subscribe(user)
    subscribe(other_user)
    assert PushSubscription.objects.get().user == other_user


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"endpoint": "http://insecure.test/x", "keys": KEYS},
        {"endpoint": ENDPOINT},
        {"endpoint": ENDPOINT, "keys": {"p256dh": "x"}},
        {"endpoint": "https://" + "a" * 1100, "keys": KEYS},
    ],
)
def test_subscribe_rejects_bad_payloads(user, payload):
    response = client_for(user).post("/api/notifications/push/subscribe/", payload, format="json")
    assert response.status_code == 400
    assert PushSubscription.objects.count() == 0


def test_unsubscribe_only_removes_own_subscription(user, other_user):
    subscribe(user)
    other = client_for(other_user).post("/api/notifications/push/unsubscribe/", {"endpoint": ENDPOINT}, format="json")
    assert other.json() == {"removed": 0}
    assert PushSubscription.objects.count() == 1

    mine = client_for(user).post("/api/notifications/push/unsubscribe/", {"endpoint": ENDPOINT}, format="json")
    assert mine.json() == {"removed": 1}
    assert PushSubscription.objects.count() == 0


# ---------------------------------------------------------------- delivery
@override_settings(VAPID_PUBLIC_KEY="", VAPID_PRIVATE_KEY="", PUSH_SEND_ASYNC=False)
def test_no_delivery_when_push_not_configured(user):
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    with mock.patch("pywebpush.webpush") as sender:
        Notification.notify(user, Notification.Kind.JOB, "New job assigned", "Chiller", "/my-jobs")
    sender.assert_not_called()


@override_settings(**SETTINGS)
def test_notify_pushes_payload_to_each_device(user):
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    PushSubscription.objects.create(user=user, endpoint="https://push.example.test/send/second", **KEYS)
    with mock.patch("pywebpush.webpush") as sender:
        notification = Notification.notify(user, Notification.Kind.JOB, "New job assigned", "Chiller 3", "/my-jobs")

    assert sender.call_count == 2
    call = sender.call_args.kwargs
    assert call["subscription_info"]["keys"] == KEYS
    assert call["vapid_private_key"] == "priv"
    assert json.loads(call["data"]) == {
        "title": "New job assigned", "body": "Chiller 3", "url": "/my-jobs", "kind": "job", "id": notification.id,
    }


@override_settings(**SETTINGS)
def test_other_users_devices_are_not_notified(user, other_user):
    PushSubscription.objects.create(user=other_user, endpoint=ENDPOINT, **KEYS)
    with mock.patch("pywebpush.webpush") as sender:
        Notification.notify(user, Notification.Kind.INFO, "Hello")
    sender.assert_not_called()


@override_settings(**SETTINGS)
def test_gone_subscription_is_removed(user):
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    gone = WebPushException("gone", response=mock.Mock(status_code=410))
    with mock.patch("pywebpush.webpush", side_effect=gone):
        Notification.notify(user, Notification.Kind.INFO, "Hello")
    assert PushSubscription.objects.count() == 0


@override_settings(**SETTINGS)
def test_temporary_failure_keeps_subscription_and_notification(user):
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    flaky = WebPushException("busy", response=mock.Mock(status_code=503))
    with mock.patch("pywebpush.webpush", side_effect=flaky):
        notification = Notification.notify(user, Notification.Kind.INFO, "Hello")
    assert PushSubscription.objects.count() == 1
    assert Notification.objects.filter(id=notification.id).exists()


@override_settings(**SETTINGS)
def test_unexpected_error_never_breaks_the_notification(user):
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    with mock.patch("pywebpush.webpush", side_effect=RuntimeError("boom")):
        notification = Notification.notify(user, Notification.Kind.INFO, "Hello")
    assert notification is not None


@override_settings(**SETTINGS)
def test_send_push_reports_device_count(user):
    note = Notification.objects.create(user=user, title="x")
    assert push.send_push(note) == 0
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    with mock.patch("pywebpush.webpush"):
        assert push.send_push(note) == 1


@override_settings(**SETTINGS)
def test_test_endpoint_creates_and_pushes_a_notification(user):
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, **KEYS)
    with mock.patch("pywebpush.webpush") as sender:
        response = client_for(user).post("/api/notifications/push/test/")
    assert response.status_code == 200
    assert sender.call_count == 1
    assert Notification.objects.filter(user=user, title="Push alerts are on").exists()


def test_generated_keys_work_with_pywebpush(capsys):
    """The command's output must be accepted as VAPID keys, or push would silently fail."""
    from io import StringIO

    from django.core.management import call_command
    from py_vapid import Vapid

    out = StringIO()
    call_command("generate_vapid_keys", stdout=out)
    lines = dict(line.split("=", 1) for line in out.getvalue().splitlines() if line.startswith("VAPID_"))
    vapid = Vapid.from_string(lines["VAPID_PRIVATE_KEY"])
    claims = vapid.sign({"sub": "mailto:a@b.test", "aud": "https://push.example.test"})
    assert "Authorization" in claims
