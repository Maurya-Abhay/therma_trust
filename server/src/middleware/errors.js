import mongoose from "mongoose";
import { ApiError } from "../lib/errors.js";

export function notFoundHandler(_req, res) {
  res.status(404).json({ detail: "Not found." });
}

/** Last stop for every error: clients always get a JSON body they can show. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  if (error instanceof ApiError) return res.status(error.status).json(error.body);

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ detail: "JSON parse error - the request body is not valid JSON." });
  }
  if (error?.type === "entity.too.large") return res.status(413).json({ detail: "Request body too large." });

  if (error instanceof mongoose.Error.ValidationError) {
    const body = {};
    for (const [field, issue] of Object.entries(error.errors)) body[field] = [issue.message];
    return res.status(400).json(body);
  }
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "non_field_errors";
    return res.status(400).json({ [field]: ["A record with this value already exists."] });
  }
  if (error?.name === "MulterError") {
    const detail = error.code === "LIMIT_FILE_SIZE" ? "That file is too large (limit 10 MB)." : "The upload could not be read.";
    return res.status(400).json({ detail });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  return res.status(500).json({ detail: "A server error occurred." });
}
