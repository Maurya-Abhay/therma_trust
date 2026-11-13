import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.management.base import BaseCommand


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


class Command(BaseCommand):
    help = "Generate a VAPID key pair for browser push alerts and print the env vars to set."

    def handle(self, *args, **options):
        key = ec.generate_private_key(ec.SECP256R1())
        private_raw = key.private_numbers().private_value.to_bytes(32, "big")
        public_raw = key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
        self.stdout.write("Set these on the backend (Render > Environment):\n")
        self.stdout.write(f"VAPID_PUBLIC_KEY={_b64url(public_raw)}")
        self.stdout.write(f"VAPID_PRIVATE_KEY={_b64url(private_raw)}")
        self.stdout.write("VAPID_CONTACT=mailto:you@yourdomain.com\n")
        self.stdout.write("Keep the private key secret; do not commit it.")
