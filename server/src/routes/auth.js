import crypto from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { ApiError, validationError } from "../lib/errors.js";
import {
  checkResetToken, decodeUid, encodeUid, hashPassword, makeResetToken, needsRehash, passwordProblems,
  signAccessToken, signRefreshToken, verifyPassword, verifyToken,
} from "../lib/security.js";
import { validateBody } from "../lib/validate.js";
import { authenticate } from "../middleware/auth.js";
import { limiter } from "../middleware/throttle.js";
import { CI, TechnicianProfile, User } from "../models/index.js";
import { presentUser } from "../presenters.js";
import { sendMail } from "../services/email.js";

const router = Router();

const normaliseEmail = (value) => value.trim().toLowerCase();

async function ensureEmailFree(email, exceptId = null) {
  const taken = await User.findOne({ email, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .collation(CI)
    .lean();
  if (taken) throw validationError({ email: "A user with this email already exists." });
}

const REGISTER_SPEC = {
  email: { type: "email", required: true },
  password: { type: "string", required: true, trim: false },
  first_name: { type: "string", blank: true, maxLength: 150, default: "" },
  last_name: { type: "string", blank: true, maxLength: 150, default: "" },
  phone: { type: "phone", default: "" },
  role: { type: "choice", required: true, choices: ["facility_manager", "technician", "contractor_manager"] },
};

router.post("/register", limiter("register"), async (req, res) => {
  const data = validateBody(req.body, REGISTER_SPEC);
  const email = normaliseEmail(data.email);
  await ensureEmailFree(email);

  const problems = passwordProblems(data.password, { email, first_name: data.first_name, last_name: data.last_name });
  if (problems.length) throw validationError({ password: problems });

  const user = await User.create({
    email,
    username: email,
    password: await hashPassword(data.password),
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    role: data.role,
  });
  if (user.role === "technician") {
    await TechnicianProfile.create({ user: user._id, public_token: crypto.randomUUID() });
  }
  res.status(201).json({
    email: user.email, first_name: user.first_name, last_name: user.last_name, phone: user.phone, role: user.role,
  });
});

router.post("/login", limiter("login"), async (req, res) => {
  const { email, password } = validateBody(req.body, {
    email: { type: "string", required: true },
    password: { type: "string", required: true, trim: false },
  });

  // Matched without regard to capitals: a phone keyboard that capitalises the
  // first letter must not lock someone out of an account made in lowercase.
  const user = await User.findOne({ email: email.trim() }).collation(CI);
  const ok = user && user.is_active && (await verifyPassword(password, user.password));
  if (!ok) throw new ApiError(401, { detail: "No active account found with the given credentials" });

  user.last_login = new Date();
  if (needsRehash(user.password)) user.password = await hashPassword(password);
  await user.save();

  const plain = user.toObject();
  res.json({ refresh: signRefreshToken(plain), access: signAccessToken(plain), user: presentUser(plain) });
});

router.post("/refresh", async (req, res) => {
  const { refresh } = validateBody(req.body, { refresh: { type: "string", required: true, trim: false } });
  const id = verifyToken(refresh, "refresh");
  const user = id ? await User.findById(id).lean() : null;
  if (!user || !user.is_active) {
    throw new ApiError(401, { detail: "Token is invalid or expired", code: "token_not_valid" });
  }
  // Refresh tokens rotate: every refresh hands back a fresh pair.
  res.json({ access: signAccessToken(user), refresh: signRefreshToken(user) });
});

router.get("/me", authenticate, (req, res) => res.json(presentUser(req.user)));

router.patch("/me", authenticate, async (req, res) => {
  const data = validateBody(
    req.body,
    {
      email: { type: "email" },
      first_name: { type: "string", blank: true, maxLength: 150 },
      last_name: { type: "string", blank: true, maxLength: 150 },
      phone: { type: "phone" },
    },
    { partial: true }
  );
  if (data.email !== undefined) {
    data.email = normaliseEmail(data.email);
    await ensureEmailFree(data.email, req.user._id);
    data.username = data.email;
  }
  const updated = await User.findByIdAndUpdate(req.user._id, data, { new: true }).lean();
  res.json(presentUser(updated));
});

// ---- password reset -----------------------------------------------------------

router.post("/password-reset", limiter("password_reset"), async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const user = email ? await User.findOne({ email }).collation(CI).lean() : null;
  // Always answer the same way, so the form cannot be used to discover which emails have accounts.
  if (user && user.is_active) {
    const link = `${config.frontendUrl}/reset-password?uid=${encodeUid(user._id)}&token=${makeResetToken(user)}`;
    await sendMail({
      to: user.email,
      subject: "Reset your ThermaTrust password",
      text:
        `Hi ${user.first_name || "there"},\n\n` +
        "We received a request to reset your ThermaTrust password. " +
        `Use this link to choose a new one:\n\n${link}\n\n` +
        "The link works once and expires after a short time. If you did not ask for this, you can ignore this email.\n",
    });
  }
  res.json({ detail: "If that email has an account, a reset link is on its way." });
});

router.post("/password-reset/confirm", limiter("password_reset"), async (req, res) => {
  const uid = String(req.body?.uid ?? "");
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");

  const id = decodeUid(uid);
  const user = id ? await User.findById(id) : null;
  if (!user || !user.is_active || !checkResetToken(user.toObject(), token)) {
    throw new ApiError(400, { detail: "This reset link is invalid or has expired. Request a new one." });
  }
  const problems = passwordProblems(password, user);
  if (problems.length) throw new ApiError(400, { password: problems });

  user.password = await hashPassword(password);
  await user.save();
  res.json({ detail: "Password updated. You can sign in now." });
});

export default router;
