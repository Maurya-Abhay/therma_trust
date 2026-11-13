import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

/** Named request budgets. Windows are one hour, matching how the limits were first described. */
const BUDGETS = {
  password_reset: { limit: 10, windowMs: 60 * 60 * 1000 },
  credential_ocr: { limit: 30, windowMs: 60 * 60 * 1000 },
  // Slows password guessing without getting in a real user's way.
  login: { limit: 60, windowMs: 15 * 60 * 1000 },
  // Stops a script from minting accounts by the thousand.
  register: { limit: 30, windowMs: 60 * 60 * 1000 },
};

/** Per-scope limiter keyed by the signed-in user when there is one, otherwise by IP. */
export function limiter(scope, overrides = {}) {
  const budget = { ...BUDGETS[scope], ...overrides };
  return rateLimit({
    windowMs: budget.windowMs,
    limit: budget.limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.env === "test" && !overrides.limit,
    keyGenerator: (req) => (req.user ? `u:${req.user._id}` : `ip:${req.ip}`),
    handler: (req, res) => {
      const seconds = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
      res.status(429).json({ detail: `Request was throttled. Expected available in ${seconds} seconds.` });
    },
  });
}
