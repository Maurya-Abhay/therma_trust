from rest_framework.permissions import BasePermission


class IsFacilityManager(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "facility_manager")


class IsTechnician(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "technician")


class IsContractorManager(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "contractor_manager")


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "admin" or request.user.is_staff)
        )
