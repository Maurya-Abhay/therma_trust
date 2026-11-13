from django.contrib import admin

from .models import CylinderTransaction, RefrigerantCylinder, ServiceReport, ServiceReportPhoto


class ServiceReportPhotoInline(admin.TabularInline):
    model = ServiceReportPhoto
    extra = 0


@admin.register(ServiceReport)
class ServiceReportAdmin(admin.ModelAdmin):
    list_display = ["job", "technician", "refrigerant_type", "status", "created_at"]
    list_filter = ["status", "refrigerant_type"]
    inlines = [ServiceReportPhotoInline]


# Cylinder balances only move through service reports (and are mirrored in
# the hash-chained audit log), so Django Admin is view-only here too.
class CylinderTransactionInline(admin.TabularInline):
    model = CylinderTransaction
    extra = 0
    can_delete = False
    fields = ["kind", "amount_kg", "balance_after_kg", "service_report", "created_at"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(RefrigerantCylinder)
class RefrigerantCylinderAdmin(admin.ModelAdmin):
    list_display = ["serial_number", "company", "refrigerant_type", "kind", "current_kg", "capacity_kg"]
    list_filter = ["kind", "refrigerant_type"]
    search_fields = ["serial_number", "company__name"]
    inlines = [CylinderTransactionInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
