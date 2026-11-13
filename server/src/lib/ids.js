import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/**
 * Sequential integer ids, like the SQL backend this replaces. The web app and
 * every URL (/jobs/2, /equipment/5) treat ids as numbers, and imported data
 * keeps the ids it already had.
 */
export async function nextId(name) {
  const counter = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return counter.seq;
}

/** Make sure future ids start above an explicitly inserted one (used by the data import). */
export async function bumpCounter(name, atLeast) {
  await Counter.updateOne({ _id: name }, { $max: { seq: atLeast } }, { upsert: true });
}

/** Define a model whose _id is a generated integer. */
export function defineModel(name, definition, { collection, indexes = [], configure } = {}) {
  const schema = new mongoose.Schema(
    { _id: { type: Number }, ...definition },
    { collection, versionKey: false, minimize: false }
  );
  schema.pre("validate", async function assignId() {
    if (this.isNew && (this._id === undefined || this._id === null)) this._id = await nextId(name);
  });
  for (const [fields, options] of indexes) schema.index(fields, options);
  if (configure) configure(schema);
  return mongoose.models[name] || mongoose.model(name, schema);
}
