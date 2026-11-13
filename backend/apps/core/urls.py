from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminDashboardView, AlertsView, AuditLogVerifyView, ChoicesView, HealthView, NotificationsReadView,
    NotificationsView, OnboardingView, PushKeyView, PushSubscribeView, PushTestView, PushUnsubscribeView,
    RefrigerantTypeViewSet, SearchView, SendAlertDigestView,
)

router = DefaultRouter()
router.register("refrigerant-types", RefrigerantTypeViewSet, basename="refrigerant-type")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("choices/", ChoicesView.as_view(), name="choices"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("audit/verify/", AuditLogVerifyView.as_view(), name="audit-verify"),
    path("alerts/", AlertsView.as_view(), name="alerts"),
    path("notifications/", NotificationsView.as_view(), name="notifications"),
    path("notifications/read/", NotificationsReadView.as_view(), name="notifications-read"),
    path("notifications/push/key/", PushKeyView.as_view(), name="push-key"),
    path("notifications/push/subscribe/", PushSubscribeView.as_view(), name="push-subscribe"),
    path("notifications/push/unsubscribe/", PushUnsubscribeView.as_view(), name="push-unsubscribe"),
    path("notifications/push/test/", PushTestView.as_view(), name="push-test"),
    path("search/", SearchView.as_view(), name="search"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("alerts/send-digest/", SendAlertDigestView.as_view(), name="alerts-send-digest"),
] + router.urls
