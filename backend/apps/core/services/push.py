"""Browser push delivery (Web Push with VAPID).

In-app notifications are the source of truth; push is a best-effort extra that
reaches a user's devices when the app is closed. Every failure is swallowed and
logged - a push problem must never break the action that triggered it.
"""

import json
import logging
import threading

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)

# A subscription the push service reports as gone (browser unsubscribed or the
# user cleared site data) can never work again, so we drop it.
GONE_STATUSES = {404, 410}


def push_enabled() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def build_payload(notification) -> str:
    return json.dumps(
        {
            "title": notification.title,
            "body": notification.body,
            "url": notification.link or "/",
            "kind": notification.kind,
            "id": notification.id,
        }
    )


def _deliver(targets, payload):
    """Send `payload` to each (subscription id, subscription info). Runs in a thread or inline."""
    from pywebpush import WebPushException, webpush

    from apps.core.models import PushSubscription

    dead = []
    for sub_id, info in targets:
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_CONTACT},
                ttl=60 * 60 * 12,
                timeout=8,
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in GONE_STATUSES:
                dead.append(sub_id)
            else:
                logger.warning("push delivery failed (status %s): %s", status, exc)
        except Exception as exc:  # network errors, malformed keys...
            logger.warning("push delivery error: %s", exc)

    if dead:
        PushSubscription.objects.filter(id__in=dead).delete()


def send_push(notification) -> int:
    """Push `notification` to the user's devices. Returns how many were attempted."""
    if not push_enabled():
        return 0

    targets = [
        (sub.id, {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}})
        for sub in notification.user.push_subscriptions.all()
    ]
    if not targets:
        return 0

    payload = build_payload(notification)

    if not settings.PUSH_SEND_ASYNC:
        _deliver(targets, payload)
        return len(targets)

    def run():
        try:
            _deliver(targets, payload)
        finally:
            connection.close()  # the thread owns its own DB connection

    threading.Thread(target=run, daemon=True, name="push-delivery").start()
    return len(targets)
