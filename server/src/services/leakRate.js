import { JobRequest, ServiceReport } from "../models/index.js";
import { num, round2 } from "../lib/decimal.js";

/**
 * Simplified EPA-style refrigerant leak-rate compliance per equipment.
 *
 * The real Section 608 rule uses different thresholds by appliance type and
 * charge size. This uses one flat threshold: good enough to flag equipment that
 * needs a closer look, not a substitute for the regulation.
 */
export const LEAK_RATE_THRESHOLD_PERCENT = 20;
const ROLLING_WINDOW_DAYS = 365;

/**
 * Rolling 12-month leak rate for each piece of equipment (batched: two queries
 * however many units). Leak rate = refrigerant added in the window / full
 * system charge * 100; a closed system only needs topping up to replace gas
 * that has gone.
 */
export async function computeLeakRates(equipmentList, asOf = new Date()) {
  if (!equipmentList.length) return new Map();
  const windowStart = new Date(asOf.getTime() - ROLLING_WINDOW_DAYS * 86_400_000);

  const jobs = await JobRequest.find({ equipment: { $in: equipmentList.map((e) => e._id) } }, { equipment: 1 }).lean();
  const equipmentByJob = new Map(jobs.map((job) => [job._id, job.equipment]));
  const reports = jobs.length
    ? await ServiceReport.find(
        { job: { $in: [...equipmentByJob.keys()] }, created_at: { $gte: windowStart, $lte: asOf } },
        { job: 1, refrigerant_added_kg: 1 }
      ).lean()
    : [];

  const addedByEquipment = new Map();
  for (const report of reports) {
    const equipmentId = equipmentByJob.get(report.job);
    addedByEquipment.set(equipmentId, (addedByEquipment.get(equipmentId) || 0) + num(report.refrigerant_added_kg));
  }

  const out = new Map();
  for (const equipment of equipmentList) {
    const added = round2(addedByEquipment.get(equipment._id) || 0);
    const charge = equipment.refrigerant_charge_kg ? num(equipment.refrigerant_charge_kg) : null;
    const result = {
      equipment_id: equipment._id,
      equipment_name: equipment.name,
      charge_kg: charge || null,
      added_kg_12mo: added,
      leak_rate_percent: null,
      threshold_percent: LEAK_RATE_THRESHOLD_PERCENT,
      exceeds_threshold: false,
      note: null,
    };
    if (!charge) {
      result.note = "No refrigerant charge recorded for this equipment — leak rate cannot be calculated.";
    } else {
      const rate = (added / charge) * 100;
      result.leak_rate_percent = round2(rate);
      result.exceeds_threshold = rate >= LEAK_RATE_THRESHOLD_PERCENT;
    }
    out.set(equipment._id, result);
  }
  return out;
}

export async function computeLeakRate(equipment, asOf) {
  return (await computeLeakRates([equipment], asOf)).get(equipment._id);
}
