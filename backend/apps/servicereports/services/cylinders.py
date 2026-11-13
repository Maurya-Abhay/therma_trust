"""Chain-of-custody rules for refrigerant cylinders.

Shared by the report serializer (friendly up-front 400s) and by the locked,
transactional write that actually moves the kilograms, so the two can't drift.
"""
from rest_framework.exceptions import ValidationError

from apps.core.models import AuditLog
from apps.servicereports.models import CylinderTransaction, RefrigerantCylinder


def validate_cylinder_use(cylinder, *, field, kind, refrigerant_type, kg, technician):
    errors = []
    if technician.contractor_id != cylinder.company_id:
        errors.append("This cylinder does not belong to your company.")
    if cylinder.kind != kind:
        wanted = "supply" if kind == RefrigerantCylinder.Kind.SUPPLY else "recovery"
        errors.append(f"Cylinder {cylinder.serial_number} is not a {wanted} cylinder.")
    if cylinder.refrigerant_type_id != refrigerant_type.id:
        errors.append(
            f"Cylinder {cylinder.serial_number} holds {cylinder.refrigerant_type.code}, "
            f"not {refrigerant_type.code}."
        )
    if kg <= 0:
        errors.append("Enter an amount greater than 0 to log against a cylinder.")
    elif kind == RefrigerantCylinder.Kind.SUPPLY and kg > cylinder.current_kg:
        errors.append(f"Cylinder {cylinder.serial_number} only has {cylinder.current_kg} kg left.")
    elif kind == RefrigerantCylinder.Kind.RECOVERY and cylinder.current_kg + kg > cylinder.capacity_kg:
        free = cylinder.capacity_kg - cylinder.current_kg
        errors.append(f"Cylinder {cylinder.serial_number} only has {free} kg of free space.")
    if errors:
        raise ValidationError({field: errors})


def apply_cylinder_movements(report, actor):
    """Move the kilograms for a just-saved report. Call inside transaction.atomic()."""
    technician = report.technician

    if report.added_from_cylinder_id:
        cylinder = RefrigerantCylinder.objects.select_for_update().select_related("refrigerant_type").get(
            pk=report.added_from_cylinder_id
        )
        validate_cylinder_use(
            cylinder, field="added_from_cylinder", kind=RefrigerantCylinder.Kind.SUPPLY,
            refrigerant_type=report.refrigerant_type, kg=report.refrigerant_added_kg, technician=technician,
        )
        cylinder.current_kg -= report.refrigerant_added_kg
        cylinder.save(update_fields=["current_kg"])
        CylinderTransaction.objects.create(
            cylinder=cylinder, kind=CylinderTransaction.Kind.DRAW, amount_kg=report.refrigerant_added_kg,
            balance_after_kg=cylinder.current_kg, service_report=report, created_by=actor,
        )
        AuditLog.record(actor, "cylinder.draw", cylinder, report_id=report.id, kg=str(report.refrigerant_added_kg))

    if report.recovered_into_cylinder_id:
        cylinder = RefrigerantCylinder.objects.select_for_update().select_related("refrigerant_type").get(
            pk=report.recovered_into_cylinder_id
        )
        validate_cylinder_use(
            cylinder, field="recovered_into_cylinder", kind=RefrigerantCylinder.Kind.RECOVERY,
            refrigerant_type=report.refrigerant_type, kg=report.refrigerant_recovered_kg, technician=technician,
        )
        cylinder.current_kg += report.refrigerant_recovered_kg
        cylinder.save(update_fields=["current_kg"])
        CylinderTransaction.objects.create(
            cylinder=cylinder, kind=CylinderTransaction.Kind.RECOVERY, amount_kg=report.refrigerant_recovered_kg,
            balance_after_kg=cylinder.current_kg, service_report=report, created_by=actor,
        )
        AuditLog.record(
            actor, "cylinder.recovery", cylinder, report_id=report.id, kg=str(report.refrigerant_recovered_kg)
        )
