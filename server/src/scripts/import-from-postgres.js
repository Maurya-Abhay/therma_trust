/**
 * Copy a ThermaTrust database from the previous Django/PostgreSQL backend into MongoDB.
 *
 *   DATABASE_URL=postgres://... MONGODB_URI=mongodb+srv://... \
 *     node src/scripts/import-from-postgres.js [--dry-run] [--replace] [--media-dir ../backend/media]
 *
 * What is preserved: every id (so URLs and links keep working), password hashes
 * (people keep their passwords), the audit log's hash chain (it still verifies),
 * public passport tokens (printed QR codes keep working) and uploaded-file paths.
 *
 *   --dry-run     read and count everything, write nothing
 *   --replace     empty the target collections first (otherwise a non-empty target aborts the import)
 *   --media-dir   copy uploaded files from the Django media folder into UPLOAD_DIR
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { config } from "../config.js";
import { connect, disconnect } from "../db.js";
import { dec } from "../lib/decimal.js";
import { bumpCounter } from "../lib/ids.js";
import * as M from "../models/index.js";

const decimal = (value) => (value === null || value === undefined ? null : dec(value));
const decimalOrZero = (value) => dec(value ?? 0);

/**
 * Microsecond-exact text of a timestamp, as Python's isoformat() printed it.
 * The audit hash was computed over that text, and a JS Date only keeps milliseconds.
 */
const isoColumn = (column, alias) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS ${alias}`;
const pythonIsoFromText = (text) => {
  const [base, micros = "000000"] = text.split(".");
  return `${base}${micros === "000000" ? "" : `.${micros}`}+00:00`;
};

/** table, model, extra SQL columns, and how to turn a row into a Mongo document. */
const TABLES = [
  {
    table: "accounts_user", model: M.User,
    map: (r) => ({
      _id: r.id, email: r.email.trim().toLowerCase(), username: r.username, password: r.password, first_name: r.first_name,
      last_name: r.last_name, phone: r.phone, role: r.role, is_staff: r.is_staff, is_superuser: r.is_superuser,
      is_active: r.is_active, date_joined: r.date_joined, last_login: r.last_login,
    }),
  },
  {
    table: "core_refrigeranttype", model: M.RefrigerantType,
    map: (r) => ({
      _id: r.id, code: r.code, name: r.name, gwp: r.gwp, is_a2l: r.is_a2l, is_ammonia: r.is_ammonia, is_high_pressure: r.is_high_pressure,
    }),
  },
  {
    table: "core_auditlog", model: M.AuditLog, order: "id", extra: isoColumn("created_at", "created_at_text"),
    map: (r) => ({
      _id: r.id, actor: r.actor_id, action: r.action, object_type: r.object_type, object_id: r.object_id,
      metadata: r.metadata ?? {}, created_at: r.created_at, created_at_iso: pythonIsoFromText(r.created_at_text),
      prev_hash: r.prev_hash, entry_hash: r.entry_hash,
    }),
  },
  {
    table: "core_notification", model: M.Notification,
    map: (r) => ({
      _id: r.id, user: r.user_id, kind: r.kind, title: r.title, body: r.body, link: r.link, read_at: r.read_at, created_at: r.created_at,
    }),
  },
  {
    table: "core_pushsubscription", model: M.PushSubscription, optional: true,
    map: (r) => ({
      _id: r.id, user: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, user_agent: r.user_agent, created_at: r.created_at,
    }),
  },
  {
    table: "facilities_facility", model: M.Facility,
    map: (r) => ({
      _id: r.id, owner: r.owner_id, name: r.name, segment: r.segment, address: r.address, service_area: r.service_area,
      contact_name: r.contact_name, contact_phone: r.contact_phone, created_at: r.created_at,
    }),
  },
  {
    table: "facilities_equipment", model: M.Equipment,
    map: (r) => ({
      _id: r.id, facility: r.facility_id, name: r.name, category: r.category, refrigerant_type: r.refrigerant_type_id,
      capacity: r.capacity, refrigerant_charge_kg: decimal(r.refrigerant_charge_kg), criticality: r.criticality,
      install_date: r.install_date, created_at: r.created_at,
    }),
  },
  {
    table: "contractors_contractorcompany", model: M.ContractorCompany,
    map: (r) => ({
      _id: r.id, manager: r.manager_id, name: r.name, registration_number: r.registration_number, service_area: r.service_area,
      response_time_commitment: r.response_time_commitment, verification_status: r.verification_status, created_at: r.created_at,
    }),
  },
  {
    table: "contractors_contractordocument", model: M.ContractorDocument,
    map: (r) => ({ _id: r.id, company: r.company_id, doc_type: r.doc_type, file: r.file, status: r.status, uploaded_at: r.uploaded_at }),
  },
  {
    table: "technicians_technicianprofile", model: M.TechnicianProfile,
    map: (r) => ({
      _id: r.id, user: r.user_id, contractor: r.contractor_id, service_area: r.service_area, years_experience: r.years_experience,
      available: r.available, bio: r.bio, public_token: String(r.public_token),
    }),
  },
  {
    table: "technicians_credential", model: M.Credential,
    map: (r) => ({
      _id: r.id, technician: r.technician_id, name: r.name, issuer_name: r.issuer_name, credential_number: r.credential_number,
      issue_date: r.issue_date, expiry_date: r.expiry_date, file: r.file, status: r.status, reviewed_by: r.reviewed_by_id,
      reviewed_at: r.reviewed_at, notes: r.notes, ai_check: r.ai_check ?? null, created_at: r.created_at,
    }),
  },
  {
    table: "technicians_capabilityskill", model: M.CapabilitySkill,
    map: (r) => ({
      _id: r.id, technician: r.technician_id, capability_type: r.capability_type, equipment_category: r.equipment_category,
      refrigerant_type: r.refrigerant_type_id, safety_domain: r.safety_domain, evidence_type: r.evidence_type, status: r.status,
      note: r.note, verified_by: r.verified_by_id, verified_at: r.verified_at,
    }),
  },
  {
    table: "technicians_workhistoryentry", model: M.WorkHistoryEntry,
    map: (r) => ({
      _id: r.id, technician: r.technician_id, equipment_category: r.equipment_category, refrigerant_type: r.refrigerant_type_id,
      job: r.job_id, description: r.description, date: r.date,
    }),
  },
  {
    table: "jobs_jobrequest", model: M.JobRequest,
    map: (r) => ({
      _id: r.id, facility: r.facility_id, equipment: r.equipment_id, created_by: r.created_by_id, description: r.description,
      urgency: r.urgency, status: r.status, risk_level: r.risk_level, required_capabilities: r.required_capabilities ?? [],
      scheduled_for: r.scheduled_for, created_at: r.created_at,
    }),
  },
  {
    table: "jobs_jobassignment", model: M.JobAssignment,
    map: (r) => ({
      _id: r.id, job: r.job_id, technician: r.technician_id, assigned_by: r.assigned_by_id, override_warning: r.override_warning,
      override_reason: r.override_reason, assigned_at: r.assigned_at,
    }),
  },
  {
    table: "jobs_jobfeedback", model: M.JobFeedback, optional: true,
    map: (r) => ({ _id: r.id, job: r.job_id, rating: r.rating, comment: r.comment, created_by: r.created_by_id, created_at: r.created_at }),
  },
  {
    table: "servicereports_servicereport", model: M.ServiceReport,
    map: (r) => ({
      _id: r.id, job: r.job_id, technician: r.technician_id, fault_description: r.fault_description,
      diagnostic_readings: r.diagnostic_readings ?? {}, refrigerant_type: r.refrigerant_type_id,
      refrigerant_added_kg: decimalOrZero(r.refrigerant_added_kg), refrigerant_recovered_kg: decimalOrZero(r.refrigerant_recovered_kg),
      added_from_cylinder: r.added_from_cylinder_id, recovered_into_cylinder: r.recovered_into_cylinder_id,
      leak_test_result: r.leak_test_result, vacuum_result: r.vacuum_result, parts_replaced: r.parts_replaced,
      safety_checklist: r.safety_checklist ?? {}, summary: r.summary, status: r.status, technician_signed_at: r.technician_signed_at,
      facility_approved_by: r.facility_approved_by_id, facility_approved_at: r.facility_approved_at, created_at: r.created_at,
    }),
  },
  {
    table: "servicereports_servicereportphoto", model: M.ServiceReportPhoto,
    map: (r) => ({ _id: r.id, report: r.report_id, image: r.image, caption: r.caption, is_before: r.is_before }),
  },
  {
    table: "servicereports_refrigerantcylinder", model: M.RefrigerantCylinder,
    map: (r) => ({
      _id: r.id, company: r.company_id, serial_number: r.serial_number, refrigerant_type: r.refrigerant_type_id, kind: r.kind,
      capacity_kg: decimalOrZero(r.capacity_kg), current_kg: decimalOrZero(r.current_kg), created_at: r.created_at,
    }),
  },
  {
    table: "servicereports_cylindertransaction", model: M.CylinderTransaction,
    map: (r) => ({
      _id: r.id, cylinder: r.cylinder_id, kind: r.kind, amount_kg: decimalOrZero(r.amount_kg),
      balance_after_kg: decimalOrZero(r.balance_after_kg), service_report: r.service_report_id, created_by: r.created_by_id,
      created_at: r.created_at,
    }),
  },
  {
    table: "assessments_assessment", model: M.Assessment,
    map: (r) => ({
      _id: r.id, title: r.title, capability_type: r.capability_type, equipment_category: r.equipment_category,
      refrigerant_type: r.refrigerant_type_id, safety_domain: r.safety_domain, pass_score_percent: r.pass_score_percent,
      is_active: r.is_active,
    }),
  },
  {
    table: "assessments_assessmentquestion", model: M.AssessmentQuestion,
    map: (r) => ({
      _id: r.id, assessment: r.assessment_id, prompt: r.prompt, choices: r.choices ?? [], correct_index: r.correct_index, order: r.order,
    }),
  },
  {
    table: "assessments_assessmentattempt", model: M.AssessmentAttempt,
    map: (r) => ({
      _id: r.id, assessment: r.assessment_id, technician: r.technician_id, answers: r.answers ?? [],
      score_percent: r.score_percent, passed: r.passed, submitted_at: r.submitted_at,
    }),
  },
];

const MEDIA_FOLDERS = ["credentials", "contractor_documents", "service_report_photos"];

async function copyMedia(from) {
  const target = path.resolve(config.uploadDir);
  let copied = 0;
  for (const folder of MEDIA_FOLDERS) {
    const source = path.join(from, folder);
    try {
      await fs.cp(source, path.join(target, folder), { recursive: true });
      copied += (await fs.readdir(source)).length;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return copied;
}

function parseArgs(argv) {
  const args = { dryRun: false, replace: false, mediaDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--replace") args.replace = true;
    else if (argv[i] === "--media-dir") args.mediaDir = argv[(i += 1)];
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return args;
}

export async function importFromPostgres({ databaseUrl, dryRun = false, replace = false, mediaDir = null, log = console.log }) {
  let pg;
  try {
    pg = (await import("pg")).default;
  } catch {
    throw new Error("The `pg` package is needed for the import: run `npm install --include=dev` first.");
  }
  // Dates (no time) must stay "YYYY-MM-DD" strings, never shifted by the local timezone.
  pg.types.setTypeParser(1082, (value) => value);
  // Django's ids are bigint, which the driver hands back as strings; the API's ids are numbers.
  pg.types.setTypeParser(20, (value) => Number(value));

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const summary = [];
  try {
    if (!dryRun) {
      const existing = await M.User.estimatedDocumentCount();
      if (existing > 0 && !replace) {
        throw new Error(`The target database already has ${existing} users. Re-run with --replace to empty it first.`);
      }
      if (replace) {
        const collections = await mongoose.connection.db.collections();
        await Promise.all(collections.map((c) => c.deleteMany({})));
      }
      await Promise.all(Object.values(M).filter((m) => m?.init).map((m) => m.init()));
    }

    for (const spec of TABLES) {
      let rows;
      try {
        const columns = spec.extra ? `*, ${spec.extra}` : "*";
        ({ rows } = await client.query(`SELECT ${columns} FROM ${spec.table}${spec.order ? ` ORDER BY ${spec.order}` : ""}`));
      } catch (error) {
        if (spec.optional && error.code === "42P01") {
          summary.push({ table: spec.table, rows: 0, note: "table not present, skipped" });
          continue;
        }
        throw error;
      }

      const docs = rows.map(spec.map);
      if (!dryRun && docs.length) {
        for (let i = 0; i < docs.length; i += 500) await spec.model.collection.insertMany(docs.slice(i, i + 500));
        await bumpCounter(spec.model.modelName, Math.max(...docs.map((d) => d._id)));
      }
      summary.push({ table: spec.table, rows: rows.length });
    }
  } finally {
    await client.end();
  }

  let mediaCopied = 0;
  if (mediaDir && !dryRun) mediaCopied = await copyMedia(path.resolve(mediaDir));

  for (const item of summary) log(`${item.table.padEnd(40)} ${String(item.rows).padStart(6)}${item.note ? `  (${item.note})` : ""}`);
  if (mediaDir) log(`media files copied: ${mediaCopied}`);
  log(dryRun ? "Dry run complete: nothing was written." : "Import complete.");
  return summary;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI explicitly: this script writes data and will not guess a database.");
    process.exit(1);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Set DATABASE_URL to the PostgreSQL connection string to import from.");
    process.exit(1);
  }
  await connect();
  try {
    await importFromPostgres({ databaseUrl, ...args });
  } catch (error) {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
}
