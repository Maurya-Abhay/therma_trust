import mongoose from "mongoose";
import { CylinderTransaction, RefrigerantCylinder, RefrigerantType } from "../models/index.js";
import { dec, num, round2 } from "../lib/decimal.js";
import { validationError } from "../lib/errors.js";

/**
 * Chain-of-custody rules for refrigerant cylinders.
 *
 * Shared by request validation (friendly up-front 400s) and by the guarded
 * writes that actually move the kilograms, so the two cannot drift. The moves
 * use conditional atomic updates rather than transactions: a cylinder can
 * never be drawn below zero or filled past capacity, even by two requests at
 * the same instant, and it works on a standalone MongoDB too.
 */
export function cylinderProblems(cylinder, cylinderRefrigerant, { kind, refrigerantType, kg, technician }) {
  const problems = [];
  const current = num(cylinder.current_kg);
  const capacity = num(cylinder.capacity_kg);

  if (technician.contractor !== cylinder.company) problems.push("This cylinder does not belong to your company.");
  if (cylinder.kind !== kind) {
    problems.push(`Cylinder ${cylinder.serial_number} is not a ${kind === "supply" ? "supply" : "recovery"} cylinder.`);
  }
  if (cylinder.refrigerant_type !== refrigerantType._id) {
    problems.push(`Cylinder ${cylinder.serial_number} holds ${cylinderRefrigerant.code}, not ${refrigerantType.code}.`);
  }
  if (kg <= 0) {
    problems.push("Enter an amount greater than 0 to log against a cylinder.");
  } else if (kind === "supply" && kg > current) {
    problems.push(`Cylinder ${cylinder.serial_number} only has ${current.toFixed(2)} kg left.`);
  } else if (kind === "recovery" && current + kg > capacity) {
    problems.push(`Cylinder ${cylinder.serial_number} only has ${round2(capacity - current).toFixed(2)} kg of free space.`);
  }
  return problems;
}

export async function validateCylinderUse(cylinderId, { field, kind, refrigerantType, kg, technician }) {
  const cylinder = await RefrigerantCylinder.findById(cylinderId).lean();
  if (!cylinder) throw validationError({ [field]: `Invalid pk "${cylinderId}" - object does not exist.` });
  const cylinderRefrigerant = await RefrigerantType.findById(cylinder.refrigerant_type).lean();
  const problems = cylinderProblems(cylinder, cylinderRefrigerant, { kind, refrigerantType, kg, technician });
  if (problems.length) throw validationError({ [field]: problems });
  return cylinder;
}

const negative = (kg) => mongoose.Types.Decimal128.fromString((-kg).toFixed(2));

async function move({ cylinderId, kind, kg, report, actor, field, technician, refrigerantType }) {
  const direction = kind === "draw" ? "supply" : "recovery";
  const guard =
    kind === "draw"
      ? { _id: cylinderId, current_kg: { $gte: dec(kg) } }
      : { _id: cylinderId, $expr: { $lte: [{ $add: ["$current_kg", dec(kg)] }, "$capacity_kg"] } };
  const change = kind === "draw" ? negative(kg) : dec(kg);

  const updated = await RefrigerantCylinder.findOneAndUpdate(guard, { $inc: { current_kg: change } }, { new: true }).lean();
  if (!updated) {
    // Lost the race, or the first validation was stale: report why, with fresh numbers.
    await validateCylinderUse(cylinderId, { field, kind: direction, refrigerantType, kg, technician });
    throw validationError({ [field]: "This cylinder changed while saving. Try again." });
  }

  const row = await CylinderTransaction.create({
    cylinder: cylinderId,
    kind,
    amount_kg: dec(kg),
    balance_after_kg: updated.current_kg,
    service_report: report._id,
    created_by: actor._id,
  });
  return { cylinderId, kind, kg, transactionId: row._id, updated };
}

/**
 * Move the kilograms for a just-saved report. Returns what was applied (so a
 * caller can undo it) and the audit entries to write once everything is done.
 */
export async function applyCylinderMovements(report, actor, technician) {
  const applied = [];
  const audits = [];
  const refrigerantType = await RefrigerantType.findById(report.refrigerant_type).lean();

  try {
    if (report.added_from_cylinder) {
      const kg = num(report.refrigerant_added_kg);
      applied.push(
        await move({
          cylinderId: report.added_from_cylinder, kind: "draw", kg, report, actor,
          field: "added_from_cylinder", technician, refrigerantType,
        })
      );
      audits.push({ action: "cylinder.draw", id: report.added_from_cylinder, metadata: { report_id: report._id, kg: kg.toFixed(2) } });
    }
    if (report.recovered_into_cylinder) {
      const kg = num(report.refrigerant_recovered_kg);
      applied.push(
        await move({
          cylinderId: report.recovered_into_cylinder, kind: "recovery", kg, report, actor,
          field: "recovered_into_cylinder", technician, refrigerantType,
        })
      );
      audits.push({
        action: "cylinder.recovery", id: report.recovered_into_cylinder, metadata: { report_id: report._id, kg: kg.toFixed(2) },
      });
    }
  } catch (error) {
    await undoMovements(applied);
    throw error;
  }
  return { applied, audits };
}

/** Reverse movements already applied, used when a later step of the same submission fails. */
export async function undoMovements(applied) {
  for (const item of [...applied].reverse()) {
    const reverse = item.kind === "draw" ? dec(item.kg) : negative(item.kg);
    await RefrigerantCylinder.updateOne({ _id: item.cylinderId }, { $inc: { current_kg: reverse } });
    await CylinderTransaction.deleteOne({ _id: item.transactionId });
  }
}
