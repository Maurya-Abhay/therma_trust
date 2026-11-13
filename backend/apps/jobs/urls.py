from rest_framework.routers import DefaultRouter

from .views import JobRequestViewSet

router = DefaultRouter()
router.register("jobs", JobRequestViewSet, basename="job")

urlpatterns = router.urls
