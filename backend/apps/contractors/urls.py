from rest_framework.routers import DefaultRouter

from .views import ContractorCompanyViewSet, ContractorDocumentViewSet

router = DefaultRouter()
router.register("contractors", ContractorCompanyViewSet, basename="contractor")
router.register("contractor-documents", ContractorDocumentViewSet, basename="contractor-document")

urlpatterns = router.urls
