from django.core.management.base import BaseCommand

from apps.core.services.alerts import send_alert_digests


class Command(BaseCommand):
    help = "Email each user a digest of their critical/warning compliance alerts."

    def handle(self, *args, **options):
        sent = send_alert_digests()
        self.stdout.write(self.style.SUCCESS(f"Sent {sent} alert digest email(s)."))
