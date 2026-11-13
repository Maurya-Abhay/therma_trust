import hashlib
import json

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


def compute_audit_entry_hash(prev_hash, actor_id, action, object_type, object_id, metadata, created_at):
    """Pure hash function shared by the model and its backfill migration.

    Kept dependency-free (no model imports) so the data migration that
    backfills hashes for pre-existing rows can duplicate/import it safely
    without coupling to future model changes.
    """
    payload = "|".join([
        prev_hash,
        str(actor_id or ""),
        action,
        object_type,
        object_id,
        json.dumps(metadata, sort_keys=True, default=str),
        created_at.isoformat(),
    ])
    return hashlib.sha256(payload.encode()).hexdigest()


class RefrigerantType(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    gwp = models.PositiveIntegerField(help_text="Global Warming Potential")
    is_a2l = models.BooleanField(default=False)
    is_ammonia = models.BooleanField(default=False)
    is_high_pressure = models.BooleanField(default=False, help_text="e.g. CO2 / R-744")

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="audit_actions"
    )
    action = models.CharField(max_length=100)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict, blank=True)
    # A plain default instead of auto_now_add: auto_now_add only fills the
    # field deep inside super().save(), too late for save() below to hash it.
    created_at = models.DateTimeField(default=timezone.now)

    # Tamper-evident chain: each entry's hash covers the previous entry's
    # hash plus its own content, so silently editing or deleting a past row
    # (e.g. straight in the DB, bypassing the read-only admin) breaks every
    # hash computed after it. Verify with AuditLog.verify_chain().
    prev_hash = models.CharField(max_length=64, blank=True, default="")
    entry_hash = models.CharField(max_length=64, blank=True, default="", editable=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} on {self.object_type}#{self.object_id} by {self.actor}"

    def _compute_hash(self):
        return compute_audit_entry_hash(
            self.prev_hash, self.actor_id, self.action, self.object_type, self.object_id,
            self.metadata, self.created_at,
        )

    def save(self, *args, **kwargs):
        if self.entry_hash:
            return super().save(*args, **kwargs)
        with transaction.atomic():
            last = AuditLog.objects.select_for_update().order_by("-id").first()
            self.prev_hash = last.entry_hash if last else ""
            self.entry_hash = self._compute_hash()
            return super().save(*args, **kwargs)

    @classmethod
    def record(cls, actor, action, obj, **metadata):
        return cls.objects.create(
            actor=actor,
            action=action,
            object_type=obj.__class__.__name__,
            object_id=str(obj.pk),
            metadata=metadata,
        )

    @classmethod
    def verify_chain(cls):
        """Walk the whole log in insertion order checking every hash and link.

        Returns (is_valid, first_broken_entry_id_or_None). Tampering with the
        single most-recent entry and recomputing its own hash to match is the
        one case this can't catch (there's no later entry to expose the
        mismatch) — the same inherent limit any hash chain has.
        """
        prev_entry_hash = ""
        for entry in cls.objects.order_by("id"):
            if entry.prev_hash != prev_entry_hash or entry.entry_hash != entry._compute_hash():
                return False, entry.id
            prev_entry_hash = entry.entry_hash
        return True, None


class Notification(models.Model):
    """A persisted in-app message for one user (job assigned, credential reviewed...).

    Compliance *alerts* are derived live from the data; notifications are
    events that happened, so they are stored and can be marked as read.
    """

    class Kind(models.TextChoices):
        JOB = "job", "Job"
        CREDENTIAL = "credential", "Credential"
        REPORT = "report", "Report"
        FEEDBACK = "feedback", "Feedback"
        INFO = "info", "Info"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.INFO)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=300, blank=True)
    link = models.CharField(max_length=200, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self):
        return f"{self.title} -> {self.user}"

    @classmethod
    def notify(cls, user, kind, title, body="", link=""):
        if user is None:
            return None
        notification = cls.objects.create(user=user, kind=kind, title=title[:200], body=body[:300], link=link[:200])
        # Also reach the user's devices when push is configured. Never let a
        # delivery problem break the action that triggered the notification.
        try:
            from .services.push import send_push

            send_push(notification)
        except Exception:  # pragma: no cover - defensive
            pass
        return notification


class PushSubscription(models.Model):
    """One browser/device a user allowed push alerts on (a Web Push subscription)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.CharField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"push:{self.user_id}:{self.endpoint[:40]}"
