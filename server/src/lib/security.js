import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

// ---- passwords ----------------------------------------------------------------

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Also accepts the PBKDF2 hashes the previous Django backend stored, so people
 * keep their passwords across the move; those are re-hashed with bcrypt on login.
 */
export async function verifyPassword(plain, stored) {
  if (!stored || typeof plain !== "string") return false;
  if (stored.startsWith("pbkdf2_sha256$")) {
    const [, iterations, salt, expected] = stored.split("$");
    const derived = crypto.pbkdf2Sync(plain, salt, Number(iterations), 32, "sha256").toString("base64");
    return constantTimeEqual(derived, expected || "");
  }
  if (stored.startsWith("$2")) return bcrypt.compare(plain, stored);
  return false;
}

export const needsRehash = (stored) => typeof stored === "string" && stored.startsWith("pbkdf2_sha256$");

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123",
  "qwertyuiop", "iloveyou", "abc12345", "abcd1234", "11111111", "00000000", "admin123", "welcome1",
  "welcome123", "letmein1", "letmein123", "monkey123", "dragon123", "football1", "baseball1", "sunshine1",
  "princess1", "trustno1", "passw0rd", "p@ssw0rd", "changeme", "changeme123", "administrator", "thermatrust",
  // Common patterns that satisfy composition rules and are guessed first.
  "password@123", "password@1234", "password1!", "password123!", "password!123", "welcome@123", "welcome@1234",
  "welcome1!", "admin@123", "admin@1234", "admin@12345", "qwerty@123", "qwerty123!", "qwerty@1234", "abcd@1234",
  "abc@12345", "india@123", "india@1234", "test@1234", "test@12345", "thermatrust@123", "thermatrust1!",
  "p@ssw0rd123", "p@ssw0rd!", "passw0rd!", "passw0rd@123", "letmein@123", "iloveyou@123", "changeme@123",
]);

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The password policy, enforced when an account is created and when a password is reset.
 * The web app shows the same rules live as someone types. Returns a list of messages;
 * empty means the password is acceptable. Signing in is never affected, so people with
 * an older, weaker password can still get in.
 */
export function passwordProblems(password, user = {}) {
  const problems = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (password.length > PASSWORD_MAX_LENGTH) problems.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push("Include both upper and lower case letters.");
  if (!/\d/.test(password)) problems.push("Include a number.");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("Include a symbol such as ! @ # ?");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push("This password is too common.");

  const lowered = password.toLowerCase();
  const attributes = [user.email, user.email?.split("@")[0], user.first_name, user.last_name, user.username];
  const similar = attributes.some(
    (value) => value && value.length >= 4 && (lowered.includes(value.toLowerCase()) || value.toLowerCase().includes(lowered))
  );
  if (similar) problems.push("The password is too similar to your personal information.");
  return problems;
}

// ---- JSON web tokens ----------------------------------------------------------

export function signAccessToken(user) {
  return jwt.sign({ typ: "access" }, config.jwtSecret, { subject: String(user._id), expiresIn: config.accessTtlSeconds });
}

export function signRefreshToken(user) {
  return jwt.sign({ typ: "refresh", jti: crypto.randomUUID() }, config.jwtSecret, {
    subject: String(user._id),
    expiresIn: config.refreshTtlSeconds,
  });
}

/** Returns the user id, or null when the token is missing, forged, expired or the wrong kind. */
export function verifyToken(token, type) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    if (payload.typ !== type) return null;
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

// ---- password-reset links -----------------------------------------------------

const RESET_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const resetSignature = (user, issued) =>
  crypto
    .createHmac("sha256", config.jwtSecret)
    // The stored password hash is part of the signature, so a link dies the moment it is used.
    .update(`${user._id}|${user.password}|${user.last_login ? new Date(user.last_login).getTime() : ""}|${issued}`)
    .digest("hex")
    .slice(0, 40);

export function makeResetToken(user, now = Date.now()) {
  const issued = now.toString(36);
  return `${issued}-${resetSignature(user, issued)}`;
}

export function checkResetToken(user, token, now = Date.now()) {
  const [issued, signature] = String(token).split("-");
  if (!issued || !signature) return false;
  const issuedAt = Number.parseInt(issued, 36);
  if (!Number.isFinite(issuedAt) || now - issuedAt > RESET_TTL_MS || issuedAt > now + 60_000) return false;
  return constantTimeEqual(signature, resetSignature(user, issued));
}

export const encodeUid = (id) => Buffer.from(String(id)).toString("base64url");

export function decodeUid(uid) {
  try {
    const id = Number(Buffer.from(String(uid), "base64url").toString());
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
