/**
 * Rule-based job risk classification.
 *
 * Not machine-learned: a transparent, explainable scoring rule so facility
 * managers and auditors can see exactly why a job was classified a given way.
 */
const CRITICALITY_WEIGHT = { low: 1, medium: 2, high: 3, critical: 4 };
const URGENCY_WEIGHT = { routine: 1, scheduled: 1, urgent: 2, emergency: 3 };

function refrigerantWeight(refrigerant) {
  if (refrigerant.is_ammonia || refrigerant.is_high_pressure) return 4;
  if (refrigerant.is_a2l) return 3;
  return 1;
}

function refrigerantSafetyDomain(refrigerant) {
  if (refrigerant.is_ammonia) return "ammonia_safety";
  if (refrigerant.is_high_pressure) return "co2_high_pressure";
  if (refrigerant.is_a2l) return "a2l_safety";
  return null;
}

function riskBand(total) {
  if (total <= 4) return "low";
  if (total <= 6) return "medium";
  if (total <= 8) return "high";
  if (total <= 10) return "very_high";
  return "critical";
}

/** Returns { riskLevel, requiredCapabilities, breakdown } for a piece of equipment and an urgency. */
export function classify(equipment, refrigerant, urgency) {
  const criticalityWeight = CRITICALITY_WEIGHT[equipment.criticality] ?? 2;
  const refrigerantW = refrigerantWeight(refrigerant);
  const urgencyWeight = URGENCY_WEIGHT[urgency] ?? 1;
  const total = criticalityWeight + refrigerantW + urgencyWeight;
  const riskLevel = riskBand(total);

  const requiredCapabilities = [
    { capability_type: "equipment", key: equipment.category },
    { capability_type: "refrigerant", key: refrigerant._id },
  ];
  const safetyDomain = refrigerantSafetyDomain(refrigerant);
  if (safetyDomain) requiredCapabilities.push({ capability_type: "safety", key: safetyDomain });
  if (["high", "very_high", "critical"].includes(riskLevel)) {
    requiredCapabilities.push({ capability_type: "safety", key: "refrigerant_recovery" });
  }

  return {
    riskLevel,
    requiredCapabilities,
    breakdown: {
      criticality_weight: criticalityWeight,
      refrigerant_weight: refrigerantW,
      urgency_weight: urgencyWeight,
      total,
    },
  };
}
