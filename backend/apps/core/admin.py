from django.contrib import admin

from .models import AuditLog, RefrigerantType

admin.site.site_header = "ThermaTrust Admin"
admin.site.site_title = "ThermaTrust Admin"
admin.site.index_title = "Platform Administration"


@admin.register(RefrigerantType)
class RefrigerantTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "gwp", "is_a2l", "is_ammonia", "is_high_pressure"]
    search_fields = ["code", "name"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "action", "object_type", "object_id"]
    list_filter = ["action", "object_type"]
    search_fields = ["object_id", "action"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
