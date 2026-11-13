from django.contrib import admin

from .models import Assessment, AssessmentAttempt, AssessmentQuestion


class AssessmentQuestionInline(admin.TabularInline):
    model = AssessmentQuestion
    extra = 1


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ["title", "capability_type", "pass_score_percent", "is_active"]
    list_filter = ["capability_type", "is_active"]
    inlines = [AssessmentQuestionInline]


@admin.register(AssessmentAttempt)
class AssessmentAttemptAdmin(admin.ModelAdmin):
    list_display = ["technician", "assessment", "score_percent", "passed", "submitted_at"]
    list_filter = ["passed", "assessment"]
    readonly_fields = [f.name for f in AssessmentAttempt._meta.fields]

    def has_add_permission(self, request):
        return False
