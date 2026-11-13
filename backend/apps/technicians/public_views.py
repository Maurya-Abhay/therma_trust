"""Public, unauthenticated views for the QR/link credential-verification flow.

Deliberately shows only verified truth — no pending items, no personal
contact details beyond a name — since anyone with the link can view it.
"""
import hmac
import io

import qrcode
from django.conf import settings
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TechnicianProfile
from .services.passport import display_name, passport_digest, render_passport_pdf, verified_facts


def _get_technician_or_none(token):
    return TechnicianProfile.objects.select_related("user", "contractor").filter(public_token=token).first()


class PublicTechnicianVerificationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        technician = _get_technician_or_none(token)
        if technician is None:
            return Response({"detail": "Not found."}, status=404)

        verified_capabilities, verified_credentials = verified_facts(technician)
        return Response(
            {
                "full_name": display_name(technician),
                "contractor_name": technician.contractor.name if technician.contractor else None,
                "years_experience": technician.years_experience,
                "verified_capabilities": verified_capabilities,
                "verified_credentials": verified_credentials,
            }
        )


class PublicTechnicianQRView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        technician = _get_technician_or_none(token)
        if technician is None:
            return Response({"detail": "Not found."}, status=404)

        url = f"{settings.FRONTEND_URL.rstrip('/')}/verify/{technician.public_token}"
        image = qrcode.make(url)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return HttpResponse(buffer.getvalue(), content_type="image/png")


class PublicTechnicianPassportPDFView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        technician = _get_technician_or_none(token)
        if technician is None:
            return Response({"detail": "Not found."}, status=404)

        pdf_bytes, _digest = render_passport_pdf(technician)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="thermatrust-passport-{technician.public_token}.pdf"'
        return response


class PublicTechnicianPassportVerifyView(APIView):
    """Tells whoever scanned a printed passport whether its records still hold."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        technician = _get_technician_or_none(token)
        if technician is None:
            return Response({"detail": "Not found."}, status=404)

        supplied = request.query_params.get("hash", "").strip().lower()
        if not supplied:
            return Response({"detail": "Provide the passport's hash."}, status=400)

        valid = hmac.compare_digest(supplied, passport_digest(technician))
        return Response({"valid": valid, "full_name": display_name(technician)})
