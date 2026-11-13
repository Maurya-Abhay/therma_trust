import { JobRequest, ServiceReport } from "../models/index.js";

/**
 * Simplified diagnostic-reading drift detection.
 *
 * `diagnostic_readings` is free-text JSON: technicians type whatever they read
 * off their gauges. This looks for a small set of commonly used keys
 * (case-insensitive), pulls the first number out of each value, and flags a
 * metric that moved in the same direction across every one of the last few
 * services on that equipment.
 */
export const TRACKED_METRICS = ["superheat", "subcooling", "amps"];
export const LOOKBACK_COUNT = 3;
const NUMBER_RE = /-?\d+(\.\d+)?/;

function extractNumber(value) {
  if (typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const match = value.match(NUMBER_RE);
    if (match) return Number(match[0]);
  }
  return null;
}

function findMetric(readings, metric) {
  if (!readings || typeof readings !== "object" || Array.isArray(readings)) return null;
  for (const [key, value] of Object.entries(readings)) {
    if (key.trim().toLowerCase() === metric) return extractNumber(value);
  }
  return null;
}

/** Pure part: flags for one equipment given its reports, newest first. */
export function driftFromReports(newestFirst) {
  if (newestFirst.length < LOOKBACK_COUNT) return [];
  const reports = newestFirst.slice(0, LOOKBACK_COUNT).reverse(); // oldest first, so direction reads naturally

  const flags = [];
  for (const metric of TRACKED_METRICS) {
    const values = reports.map((report) => findMetric(report.diagnostic_readings, metric));
    if (values.some((v) => v === null)) continue;
    const increasing = values.every((v, i) => i === 0 || values[i - 1] < v);
    const decreasing = values.every((v, i) => i === 0 || values[i - 1] > v);
    if (increasing || decreasing) {
      flags.push({ metric, values, direction: increasing ? "increasing" : "decreasing" });
    }
  }
  return flags;
}

/** Drift warnings for many equipment at once: Map(equipmentId -> flags[]). Two queries in total. */
export async function detectDriftBatch(equipmentIds) {
  const out = new Map(equipmentIds.map((id) => [id, []]));
  if (!equipmentIds.length) return out;

  const jobs = await JobRequest.find({ equipment: { $in: equipmentIds } }, { equipment: 1 }).lean();
  if (!jobs.length) return out;
  const equipmentByJob = new Map(jobs.map((job) => [job._id, job.equipment]));

  const reports = await ServiceReport.find(
    { job: { $in: [...equipmentByJob.keys()] } },
    { job: 1, diagnostic_readings: 1, created_at: 1 }
  )
    .sort({ created_at: -1, _id: -1 })
    .lean();

  const grouped = new Map();
  for (const report of reports) {
    const equipmentId = equipmentByJob.get(report.job);
    const list = grouped.get(equipmentId) ?? [];
    if (list.length < LOOKBACK_COUNT) list.push(report);
    grouped.set(equipmentId, list);
  }
  for (const [equipmentId, list] of grouped) out.set(equipmentId, driftFromReports(list));
  return out;
}

export async function detectDrift(equipmentId) {
  return (await detectDriftBatch([equipmentId])).get(equipmentId) ?? [];
}
