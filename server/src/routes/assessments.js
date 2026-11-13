import { Router } from "express";
import { ApiError, forbidden } from "../lib/errors.js";
import { getScoped } from "../lib/http.js";
import { nextId } from "../lib/ids.js";
import { filtersFrom, paginate } from "../lib/pagination.js";
import { authenticate } from "../middleware/auth.js";
import { Assessment, AssessmentAttempt, AssessmentQuestion, CapabilitySkill, TechnicianProfile } from "../models/index.js";
import { presentAssessments, presentAttempts } from "../presenters.js";

const router = Router();
router.use("/assessments", authenticate);

router.get("/assessments", async (req, res) => {
  const filter = { is_active: true, ...filtersFrom(req, { capability_type: "capability_type" }) };
  res.json(
    await paginate(req, {
      model: Assessment,
      filter,
      build: (skip, limit) => Assessment.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      present: presentAssessments,
    })
  );
});

router.get("/assessments/:id", async (req, res) => {
  const assessment = await getScoped(Assessment, req, { is_active: true });
  res.json((await presentAssessments([assessment]))[0]);
});

/**
 * Score an attempt. Passing auto-verifies the matching capability with
 * practical-assessment evidence: the score itself is the proof.
 */
router.post("/assessments/:id/submit", async (req, res) => {
  const assessment = await getScoped(Assessment, req, { is_active: true });
  const technician = await TechnicianProfile.findOne({ user: req.user._id }).lean();
  if (!technician) throw forbidden("Only technicians can take assessments.");

  const questions = await AssessmentQuestion.find({ assessment: assessment._id }).sort({ order: 1, _id: 1 }).lean();
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw new ApiError(400, {
      detail: `Expected ${questions.length} answers, got ${Array.isArray(answers) ? answers.length : 0}.`,
    });
  }

  const correct = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const passed = score >= assessment.pass_score_percent;

  const attempt = await AssessmentAttempt.create({
    assessment: assessment._id,
    technician: technician._id,
    answers: answers.map((a) => (Number.isInteger(a) ? a : -1)),
    score_percent: score,
    passed,
  });

  let capabilityStatus = null;
  if (passed) {
    const skill = await CapabilitySkill.findOneAndUpdate(
      {
        technician: technician._id,
        capability_type: assessment.capability_type,
        equipment_category: assessment.equipment_category || "",
        refrigerant_type: assessment.refrigerant_type ?? null,
        safety_domain: assessment.safety_domain || "",
      },
      {
        $set: {
          evidence_type: "practical_assessment",
          status: "verified",
          verified_by: null,
          verified_at: new Date(),
          note: `Auto-verified by passing '${assessment.title}' (${score}%).`.slice(0, 300),
        },
        $setOnInsert: { _id: await nextId("CapabilitySkill") },
      },
      { upsert: true, new: true }
    ).lean();
    capabilityStatus = skill.status;
  }

  const [presented] = await presentAttempts([attempt.toObject()], new Map([[assessment._id, assessment]]));
  res.status(201).json({ ...presented, capability_status: capabilityStatus });
});

export default router;
