import mongoose from "mongoose";

const { Decimal128 } = mongoose.Types;

/** Quantities in kg are exact to 2 places; Decimal128 keeps $inc exact where floats would drift. */
export const dec = (value) => Decimal128.fromString((Math.round(Number(value) * 100) / 100).toFixed(2));

/** Decimal128 | string | number | null -> number */
export function num(value) {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
}

/** How the API prints a decimal field: a string with two places, like "12.50". */
export function money2(value) {
  if (value === null || value === undefined) return null;
  return num(value).toFixed(2);
}

export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
