import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { readUpload, uploadRoot } from "./middleware/upload.js";
import { verifyFileSignature } from "./lib/http.js";
import assessments from "./routes/assessments.js";
import auth from "./routes/auth.js";
import contractors from "./routes/contractors.js";
import core from "./routes/core.js";
import facilities from "./routes/facilities.js";
import jobs from "./routes/jobs.js";
import serviceReports from "./routes/serviceReports.js";
import technicians from "./routes/technicians.js";

const INLINE_SAFE = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"]);

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Cron-Token"],
      exposedHeaders: ["Content-Disposition"],
      maxAge: 86400,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  // Evidence files are not public static assets. Presenters issue short-lived,
  // path-bound signatures only after the caller has passed the relevant API scope.
  // This lets native image/document viewers load files without exposing /uploads.
  fs.mkdirSync(uploadRoot(), { recursive: true });
  const allowedFolders = new Set(["credentials", "contractor_documents", "service_report_photos"]);
  const contentTypes = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  app.get("/media/:folder/:filename", async (req, res, next) => {
    try {
      const { folder, filename } = req.params;
      const relative = `${folder}/${filename}`;
      if (!allowedFolders.has(folder) || filename.includes("/") || filename.includes("\\") || filename.startsWith(".")) {
        return res.status(404).json({ detail: "File not found." });
      }
      if (!verifyFileSignature(relative, req.query.expires, req.query.sig)) {
        return res.status(403).json({ detail: "This file link is invalid or expired. Reload the record to get a new link." });
      }
      const bytes = await readUpload(relative);
      if (!bytes) return res.status(404).json({ detail: "File not found." });
      const ext = path.extname(filename).toLowerCase();
      const contentType = contentTypes[ext] || "application/octet-stream";
      res.set({
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": contentType.startsWith("image/") ? "inline" : "attachment",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "cross-origin",
      });
      return res.send(bytes);
    } catch (error) {
      return next(error);
    }
  });

  // The same route tree answers with and without the trailing slash the web app uses.
  app.use("/api/auth", auth);
  app.use("/api", core);
  app.use("/api", facilities);
  app.use("/api", contractors);
  app.use("/api", technicians);
  app.use("/api", jobs);
  app.use("/api", serviceReports);
  app.use("/api", assessments);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
