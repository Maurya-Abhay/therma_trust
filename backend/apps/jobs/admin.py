from django.contrib import admin

from .models import JobAssignment, JobRequest


class JobAssignmentInline(admin.StackedInline):
    model = JobAssignment
    extra = 0


@admin.register(JobRequest)
class JobRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "facility", "equipment", "risk_level", "urgency", "status", "created_at"]
    list_filter = ["risk_level", "status", "urgency"]
    search_fields = ["facility__name", "equipment__name"]
    inlines = [JobAssignmentInline]


@admin.register(JobAssignment)
class JobAssignmentAdmin(admin.ModelAdmin):
    list_display = ["job", "technician", "override_warning", "assigned_at"]
    list_filter = ["override_warning"]
