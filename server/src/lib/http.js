import crypto from "node:crypto";
import { config } from "../config.js";
import { forbidden, notFound } from "./errors.js";

/** `/jobs/12` -> 12; anything else is a 404, never a database error. */
export function parseId(value) {
  return /^\d+$/.test(String(value)) ? Number(value) : null;
}

/** Load a record that must be inside `scope` (the caller's visibility filter) or answer 404, like a missing row. */
export async function getScoped(Model, req, scope = {}, id = req.params.id) {
  const numeric = parseId(id);
  if (numeric === null) throw notFound();
  // $and, not a spread: a scope of { _id: { $in: [...] } } must not be replaced by the requested id.
  const doc = await Model.findOne({ $and: [scope, { _id: numeric }] }).lean();
  if (!doc) throw notFound();
  return doc;
}

export const apiBase = (req) => config.publicApiUrl || `${req.protocol}://${req.get("host")}`;

/**
 * Short-lived, signed download links for uploaded evidence. The URL is a bearer
 * credential for at most 15 minutes and is only emitted by already-authorized
 * API presenters; uploaded files are never exposed through an unguarded static
 * directory. The signature binds both the normalized relative path and expiry.
 */
const FILE_URL_TTL_SECONDS = 15 * 60;
const fileSignature = (relative, expires) =>
  crypto.createHmac("sha256", config.jwtSecret).update(`${relative}:${expires}`).digest("hex");

export function verifyFileSignature(relative, expires, signature) {
  if (!relative || !/^\d+$/.test(String(expires)) || !/^[a-f0-9]{64}$/i.test(String(signature))) return false;
  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(fileSignature(relative, expiry), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

export const fileUrl = (req, relative) => {
  if (!relative) return null;
  const normalized = String(relative).replaceAll("\\", "/");
  if (config.imagekit.urlEndpoint && normalized.startsWith(`${config.imagekit.urlEndpoint}/`)) return normalized;
  if (normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    return null;
  }
  const expires = Math.floor(Date.now() / 1000) + FILE_URL_TTL_SECONDS;
  const [folder, ...parts] = normalized.split("/");
  const filename = parts.join("/");
  if (!filename || parts.length !== 1) return null;
  const signature = fileSignature(normalized, expires);
  return `${apiBase(req)}/media/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}?expires=${expires}&sig=${signature}`;
};

export function requireAdmin(user, message = "Admin only.") {
  if (!(user?.role === "admin" || user?.is_staff === true)) throw forbidden(message);
}

export function sendPdf(res, bytes, filename) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": String(bytes.length),
  });
  res.send(bytes);
}

export const timestamp = (value) => (value instanceof Date ? value.toISOString() : value ?? null);
