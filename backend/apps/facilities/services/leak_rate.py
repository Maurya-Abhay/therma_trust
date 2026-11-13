"""Simplified EPA-style refrigerant leak-rate compliance per equipment.

The real EPA Section 608 leak-rate rule uses different thresholds by
appliance type and charge size (e.g. 10% for comfort cooling, 20% for other
industrial process refrigeration, 30% for commercial refrigeration) and has
its own recordkeeping/reporting procedure. This uses one flat threshold as an
approximation — good enough to flag equipment that needs a closer compliance
look, not a substitute for the actual regulation.
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

DEFAULT_LEAK_RATE_THRESHOLD_PERCENT = Decimal("20")
ROLLING_WINDOW_DAYS = 365


def compute_leak_rate(equipment, as_of=None):
    """Rolling 12-month leak rate for one piece of equipment.

    Leak rate = refrigerant added in the window / full system charge * 100.
    Added refrigerant is EPA's own proxy for "how much leaked" — a closed
    system only needs a top-up to replace gas that's gone.
    """
    as_of = as_of or timezone.now()
    window_start = as_of - timedelta(days=ROLLING_WINDOW_DAYS)

    from apps.servicereports.models import ServiceReport

    added = ServiceReport.objects.filter(
        job__equipment=equipment, created_at__gte=window_start, created_at__lte=as_of,
    ).aggregate(total=Sum("refrigerant_added_kg"))["total"] or Decimal("0")

    # Coerce defensively: a freshly-assigned-but-not-refetched value can
    # still be a plain str/int here rather than the Decimal the DB would
    # hand back, and Decimal refuses to divide against those.
    charge = Decimal(str(equipment.refrigerant_charge_kg)) if equipment.refrigerant_charge_kg else None
    result = {
        "equipment_id": equipment.id,
        "equipment_name": equipment.name,
        "charge_kg": float(charge) if charge else None,
        "added_kg_12mo": float(added),
        "leak_rate_percent": None,
        "threshold_percent": float(DEFAULT_LEAK_RATE_THRESHOLD_PERCENT),
        "exceeds_threshold": False,
        "note": None,
    }
    if not charge:
        result["note"] = "No refrigerant charge recorded for this equipment — leak rate cannot be calculated."
        return result

    leak_rate_percent = (added / charge) * 100
    result["leak_rate_percent"] = round(float(leak_rate_percent), 2)
    result["exceeds_threshold"] = leak_rate_percent >= DEFAULT_LEAK_RATE_THRESHOLD_PERCENT
    return result
