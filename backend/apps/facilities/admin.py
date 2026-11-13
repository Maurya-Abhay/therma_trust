from django.contrib import admin

from .models import Equipment, Facility


class EquipmentInline(admin.TabularInline):
    model = Equipment
    extra = 0


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "segment", "service_area", "created_at"]
    list_filter = ["segment"]
    search_fields = ["name", "address"]
    inlines = [EquipmentInline]


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ["name", "facility", "category", "refrigerant_type", "criticality"]
    list_filter = ["category", "criticality"]
    search_fields = ["name"]
