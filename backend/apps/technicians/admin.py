from django.contrib import admin

from .models import CapabilitySkill, Credential, TechnicianProfile, WorkHistoryEntry


# Credential and CapabilitySkill review happens exclusively in the React
# Admin Dashboard now (CredentialsReviewPage / CapabilitiesReviewPage, both
# calling the same verify() API actions). Django Admin stays view-only for
# these two — no bulk actions, no edit form — so there's a single place
# approvals can happen, not two.
@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = ["name", "technician", "issuer_name", "status", "expiry_date", "reviewed_by", "created_at"]
    list_filter = ["status"]
    search_fields = ["name", "issuer_name", "credential_number", "technician__user__email"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(CapabilitySkill)
class CapabilitySkillAdmin(admin.ModelAdmin):
    list_display = ["technician", "capability_type", "label", "status", "evidence_type", "verified_by"]
    list_filter = ["capability_type", "status", "evidence_type"]
    search_fields = ["technician__user__email"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class CredentialInline(admin.TabularInline):
    model = Credential
    extra = 0
    fields = ["name", "issuer_name", "status", "expiry_date"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class CapabilitySkillInline(admin.TabularInline):
    model = CapabilitySkill
    extra = 0
    fields = ["capability_type", "equipment_category", "refrigerant_type", "safety_domain", "status"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(TechnicianProfile)
class TechnicianProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "contractor", "service_area", "years_experience", "available"]
    list_filter = ["available", "contractor"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    inlines = [CredentialInline, CapabilitySkillInline]


@admin.register(WorkHistoryEntry)
class WorkHistoryEntryAdmin(admin.ModelAdmin):
    list_display = ["technician", "equipment_category", "refrigerant_type", "date"]
    list_filter = ["equipment_category"]
