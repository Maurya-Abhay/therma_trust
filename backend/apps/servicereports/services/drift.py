"""Simplified diagnostic-reading drift detection.

`diagnostic_readings` is free-text JSON — technicians type whatever they read
off their gauges, with no fixed schema. This looks for a small set of
commonly-used keys (case-insensitive), pulls the first number out of each
value, and flags a metric that moved in the same direction across every one
of the last few services on that equipment. It's a cheap, explainable
stand-in for real predictive maintenance, not a substitute for it.
"""
import re

TRACKED_METRICS = ["superheat", "subcooling", "amps"]
LOOKBACK_COUNT = 3
NUMBER_RE = re.compile(r"-?\d+(\.\d+)?")


def _extract_number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = NUMBER_RE.search(value)
        if match:
            return float(match.group())
    return None


def _find_metric_value(readings, metric):
    if not isinstance(readings, dict):
        return None
    for key, value in readings.items():
        if isinstance(key, str) and key.strip().lower() == metric:
            return _extract_number(value)
    return None


def detect_drift(equipment):
    """Flags tracked metrics trending consistently up or down.

    Returns a list of {metric, values, direction}. Equipment with fewer than
    LOOKBACK_COUNT service reports, or missing readings for a metric, is
    skipped for that metric — not enough history to call it a trend.
    """
    from apps.servicereports.models import ServiceReport

    reports = list(
        ServiceReport.objects.filter(job__equipment=equipment)
        .order_by("-created_at", "-id")[:LOOKBACK_COUNT]
    )
    if len(reports) < LOOKBACK_COUNT:
        return []

    reports.reverse()  # oldest first, so direction reads naturally

    flags = []
    for metric in TRACKED_METRICS:
        values = [_find_metric_value(r.diagnostic_readings, metric) for r in reports]
        if any(v is None for v in values):
            continue
        increasing = all(values[i] < values[i + 1] for i in range(len(values) - 1))
        decreasing = all(values[i] > values[i + 1] for i in range(len(values) - 1))
        if increasing or decreasing:
            flags.append({
                "metric": metric,
                "values": values,
                "direction": "increasing" if increasing else "decreasing",
            })
    return flags
