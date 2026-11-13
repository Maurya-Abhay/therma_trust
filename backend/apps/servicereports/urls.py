from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CylinderViewSet, RefrigerantComplianceExportView, RefrigerantDashboardView, ServiceReportPhotoViewSet, ServiceReportViewSet,
)

router = DefaultRouter()
router.register("service-reports", ServiceReportViewSet, basename="service-report")
router.register("cylinders", CylinderViewSet, basename="cylinder")
router.register("service-report-photos", ServiceReportPhotoViewSet, basename="service-report-photo")

urlpatterns = [
    path("dashboard/refrigerant-summary/", RefrigerantDashboardView.as_view(), name="refrigerant-dashboard"),
    path("dashboard/refrigerant-summary/export/", RefrigerantComplianceExportView.as_view(), name="refrigerant-compliance-export"),
] + router.urls
