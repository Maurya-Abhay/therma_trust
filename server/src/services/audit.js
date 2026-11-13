import crypto from "node:crypto";
import { AuditLog } from "../models/index.js";
import { nextId } from "../lib/ids.js";
import { pyJsonDumps } from "../lib/pyjson.js";
import { pythonIso } from "../lib/dates.js";

/**
 * Tamper-evident audit trail.
 *
 * Every entry's hash covers the previous entry's hash plus its own content, so
 * editing or deleting a past row, even straight in the database, breaks every
 * hash computed after it. The formula is the one the SQL backend used, so a
 * chain carried over from it keeps verifying.
 */
export function computeEntryHash(entry) {
  const payload = [
    entry.prev_hash || "",
    entry.actor === null || entry.actor === undefined ? "" : String(entry.actor),
    entry.action,
    entry.object_type,
    String(entry.object_id),
    pyJsonDumps(entry.metadata ?? {}),
    entry.created_at_iso || pythonIso(new Date(entry.created_at)),
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

const MAX_ATTEMPTS = 8;
let writing = Promise.resolve();

/**
 * Append one entry. `actor` is a user (or id), `type` the record's class name
 * ("JobRequest"), `id` its primary key.
 */
export function recordAudit(actor, action, type, id, metadata = {}) {
  const actorId = actor && typeof actor === "object" ? actor._id : actor ?? null;
  // Serialise writers inside this process; the unique index on prev_hash settles races between processes.
  const run = writing.then(() => append(actorId, action, type, String(id), metadata));
  writing = run.catch(() => {});
  return run;
}

async function append(actor, action, type, id, metadata) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const last = await AuditLog.findOne({}, { entry_hash: 1 }).sort({ _id: -1 }).lean();
    const created = new Date();
    const entry = {
      _id: await nextId("AuditLog"),
      actor,
      action,
      object_type: type,
      object_id: id,
      metadata,
      created_at: created,
      created_at_iso: pythonIso(created),
      prev_hash: last?.entry_hash || "",
    };
    entry.entry_hash = computeEntryHash(entry);
    try {
      return await AuditLog.create(entry);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      // Someone else extended the chain first; read the new tail and try again.
    }
  }
  throw new Error("Could not append to the audit log: too much contention.");
}

/** Walk the whole log in order. Returns { valid, brokenAtId, checked }. */
export async function verifyChain() {
  let previous = "";
  let checked = 0;
  for await (const entry of AuditLog.find({}).sort({ _id: 1 }).lean().cursor()) {
    checked += 1;
    if (entry.prev_hash !== previous || entry.entry_hash !== computeEntryHash(entry)) {
      return { valid: false, brokenAtId: entry._id, checked };
    }
    previous = entry.entry_hash;
  }
  return { valid: true, brokenAtId: null, checked };
}
