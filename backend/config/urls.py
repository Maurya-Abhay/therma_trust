from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.facilities.urls")),
    path("api/", include("apps.contractors.urls")),
    path("api/", include("apps.technicians.urls")),
    path("api/", include("apps.jobs.urls")),
    path("api/", include("apps.servicereports.urls")),
    path("api/", include("apps.assessments.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
