from django.contrib import admin

from .models import ContractorCompany, ContractorDocument


# Contractor verification and document review happen exclusively in the
# React Admin Dashboard now (ContractorVerificationsReviewPage /
# ContractorDocumentsReviewPage, both calling the same verify() API
# actions). Django Admin stays view-only for these two — no bulk actions,
# no edit form — so there's a single place approvals can happen, not two.
class ContractorDocumentInline(admin.TabularInline):
    model = ContractorDocument
    extra = 0
    fields = ["doc_type", "file", "status"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ContractorCompany)
class ContractorCompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "manager", "verification_status", "service_area", "created_at"]
    list_filter = ["verification_status"]
    search_fields = ["name", "registration_number"]
    inlines = [ContractorDocumentInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ContractorDocument)
class ContractorDocumentAdmin(admin.ModelAdmin):
    list_display = ["company", "doc_type", "status", "uploaded_at"]
    list_filter = ["doc_type", "status"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
