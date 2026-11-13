import { Router } from "express";
import mongoose from "mongoose";
import { config } from "../config.js";
import * as C from "../lib/choices.js";
import { forbidden, validationError } from "../lib/errors.js";
import { getScoped, requireAdmin } from "../lib/http.js";
import { filtersFrom, paginate } from "../lib/pagination.js";
import { constantTimeEqual } from "../lib/security.js";
import { authenticate } from "../middleware/auth.js";
import {
  AuditLog, ContractorCompany, ContractorDocument, CapabilitySkill, Credential, Facility, JobRequest, Notification,
  PushSubscription, RefrigerantType, TechnicianProfile, User, byId,
} from "../models/index.js";
import { presentRefrigerant } from "../presenters.js";
import { computeAlerts, sendAlertDigests } from "../services/alerts.js";
import { verifyChain } from "../services/audit.js";
import { notify } from "../services/notify.js";
import { buildChecklist } from "../services/onboarding.js";
import { pushEnabled } from "../services/push.js";
import { search } from "../services/search.js";

const router = Router();

// ---- unauthenticated ----------------------------------------------------------

/** Liveness check, pinged on a schedule. It touches the database so a pausing database stays awake too. */
router.get("/health", async (_req, res) => {
  await mongoose.connection.db.admin().ping();
  res.json({ status: "ok" });
});

/** Lets an external scheduler trigger the daily digest; guarded by a shared secret, not a login. */
router.post("/alerts/send-digest", async (req, res) => {
  const expected = config.alertsCronToken;
  const supplied = req.get("x-cron-token") || "";
  if (!expected || !constantTimeEqual(supplied, expected)) throw forbidden("Invalid or missing cron token.");
  res.json({ emails_sent: await sendAlertDigests() });
});

// ---- everything below needs a signed-in user (authenticate is applied per route, because this
// router shares the /api prefix with the public routes) -----------------------------------------


router.get("/choices", authenticate, (_req, res) => {
  res.json({
    equipment_categories: C.EquipmentCategory.options,
    safety_domains: C.SafetyDomain.options,
    capability_types: C.CapabilityType.options,
    evidence_types: C.EvidenceType.options,
    capability_statuses: C.CapabilityStatus.options,
    credential_statuses: C.CredentialStatus.options,
    criticalities: C.Criticality.options,
    urgencies: C.Urgency.options,
    risk_levels: C.RiskLevel.options,
    job_statuses: C.JobStatus.options,
  });
});

router.get("/alerts", authenticate, async (req, res) => res.json(await computeAlerts(req.user)));

router.get("/audit/verify", authenticate, async (req, res) => {
  requireAdmin(req.user);
  const chain = await verifyChain();
  res.json({ valid: chain.valid, broken_at_id: chain.brokenAtId, checked_count: await AuditLog.countDocuments() });
});

router.get("/admin/dashboard", authenticate, async (req, res) => {
  requireAdmin(req.user);
  const [
    pendingCredentials, pendingCapabilities, pendingDocuments, pendingVerifications,
    technicians, facilities, jobs, recent,
  ] = await Promise.all([
    Credential.countDocuments({ status: "pending" }),
    CapabilitySkill.countDocuments({ status: "pending" }),
    ContractorDocument.countDocuments({ status: "pending" }),
    ContractorCompany.countDocuments({ verification_status: "pending" }),
    TechnicianProfile.countDocuments(),
    Facility.countDocuments(),
    JobRequest.countDocuments(),
    AuditLog.find({}).sort({ created_at: -1, _id: -1 }).limit(15).lean(),
  ]);
  const actors = await byId(User, recent.map((a) => a.actor));
  res.json({
    pending_credentials: pendingCredentials,
    pending_capabilities: pendingCapabilities,
    pending_contractor_documents: pendingDocuments,
    pending_contractor_verifications: pendingVerifications,
    total_technicians: technicians,
    total_facilities: facilities,
    total_jobs: jobs,
    recent_audit_log: recent.map((a) => ({
      id: a._id,
      actor: actors.get(a.actor)?.email ?? null,
      action: a.action,
      object_type: a.object_type,
      object_id: a.object_id,
      created_at: a.created_at.toISOString(),
    })),
  });
});

// ---- notifications ------------------------------------------------------------

router.get("/notifications", authenticate, async (req, res) => {
  const [unread, items] = await Promise.all([
    Notification.countDocuments({ user: req.user._id, read_at: null }),
    Notification.find({ user: req.user._id }).sort({ created_at: -1, _id: -1 }).limit(30).lean(),
  ]);
  res.json({
    unread_count: unread,
    results: items.map((n) => ({
      id: n._id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: n.read_at !== null,
      created_at: n.created_at.toISOString(),
    })),
  });
});

router.post("/notifications/read", authenticate, async (req, res) => {
  const filter = { user: req.user._id, read_at: null };
  if (!req.body?.all) {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Number.isInteger) : [];
    filter._id = { $in: ids };
  }
  const result = await Notification.updateMany(filter, { read_at: new Date() });
  res.json({ updated: result.modifiedCount });
});

router.get("/notifications/push/key", authenticate, (_req, res) => {
  const enabled = pushEnabled();
  res.json({ enabled, public_key: enabled ? config.vapid.publicKey : "" });
});

router.post("/notifications/push/subscribe", authenticate, async (req, res) => {
  const endpoint = req.body?.endpoint;
  const keys = req.body?.keys && typeof req.body.keys === "object" ? req.body.keys : {};
  if (!(typeof endpoint === "string" && endpoint.startsWith("https://") && endpoint.length <= 1000)) {
    throw validationError({ endpoint: "A valid https push endpoint is required." });
  }
  if (!(typeof keys.p256dh === "string" && typeof keys.auth === "string" && keys.p256dh && keys.auth)) {
    throw validationError({ keys: "p256dh and auth keys are required." });
  }
  // The same browser profile can be used by different people in turn, so the latest signed-in user takes over.
  const fields = {
    user: req.user._id,
    p256dh: keys.p256dh.slice(0, 200),
    auth: keys.auth.slice(0, 100),
    user_agent: (req.get("user-agent") || "").slice(0, 300),
  };
  const existing = await PushSubscription.findOne({ endpoint });
  if (existing) await PushSubscription.updateOne({ _id: existing._id }, fields);
  else await PushSubscription.create({ endpoint, ...fields });
  res.status(201).json({ subscribed: true });
});

router.post("/notifications/push/unsubscribe", authenticate, async (req, res) => {
  const endpoint = req.body?.endpoint;
  let removed = 0;
  if (typeof endpoint === "string") {
    removed = (await PushSubscription.deleteMany({ user: req.user._id, endpoint })).deletedCount;
  }
  res.json({ removed });
});

router.post("/notifications/push/test", authenticate, async (req, res) => {
  await notify(
    req.user._id, "info", "Push alerts are on",
    "You will be told here about new jobs, reviews and report decisions.", "/"
  );
  res.json({ sent: true });
});

// ---- search / onboarding / reference data -------------------------------------

router.get("/search", authenticate, async (req, res) => {
  res.json({ results: await search(req.user, req.query.q) });
});

router.get("/onboarding", authenticate, async (req, res) => res.json(await buildChecklist(req.user)));

router.get("/refrigerant-types", authenticate, async (req, res) => {
  const filter = filtersFrom(req, {});
  res.json(
    await paginate(req, {
      model: RefrigerantType,
      filter,
      build: (skip, limit) => RefrigerantType.find(filter).sort({ code: 1 }).skip(skip).limit(limit).lean(),
      present: async (rows) => rows.map(presentRefrigerant),
    })
  );
});

router.get("/refrigerant-types/:id", authenticate, async (req, res) => {
  res.json(presentRefrigerant(await getScoped(RefrigerantType, req)));
});

export default router;
