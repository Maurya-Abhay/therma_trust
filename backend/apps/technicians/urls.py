from django.urls import path
from rest_framework.routers import DefaultRouter

from .public_views import (
    PublicTechnicianPassportPDFView, PublicTechnicianPassportVerifyView, PublicTechnicianQRView,
    PublicTechnicianVerificationView,
)
from .views import CapabilitySkillViewSet, CredentialViewSet, TechnicianProfileViewSet, WorkHistoryEntryViewSet

router = DefaultRouter()
router.register("technicians", TechnicianProfileViewSet, basename="technician")
router.register("credentials", CredentialViewSet, basename="credential")
router.register("capabilities", CapabilitySkillViewSet, basename="capability")
router.register("work-history", WorkHistoryEntryViewSet, basename="work-history")

urlpatterns = router.urls + [
    path("public/technicians/<uuid:token>/", PublicTechnicianVerificationView.as_view(), name="public-technician"),
    path("public/technicians/<uuid:token>/qr/", PublicTechnicianQRView.as_view(), name="public-technician-qr"),
    path("public/technicians/<uuid:token>/passport.pdf", PublicTechnicianPassportPDFView.as_view(), name="public-technician-passport"),
    path(
        "public/technicians/<uuid:token>/passport/verify/", PublicTechnicianPassportVerifyView.as_view(),
        name="public-technician-passport-verify",
    ),
]
