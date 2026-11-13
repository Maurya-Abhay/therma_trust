import fs from "node:fs";

// Load a local .env when present (Node 20.12+). Real environment variables win.
if (fs.existsSync(".env") && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* a malformed .env should not stop the process from reading the real environment */
  }
}

const env = process.env;
const bool = (value, fallback) => (value === undefined || value === "" ? fallback : /^(1|true|yes|on)$/i.test(value));
const list = (value) =>
  (value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export const config = {
  env: env.NODE_ENV || "development",
  port: Number(env.PORT || 8000),
  mongoUri: env.MONGODB_URI || "mongodb://127.0.0.1:27017/thermatrust",
  jwtSecret: env.JWT_SECRET || "dev-only-secret-change-me",
  accessTtlSeconds: 8 * 60 * 60,
  refreshTtlSeconds: 7 * 24 * 60 * 60,
  corsOrigins: list(env.CORS_ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"),
  frontendUrl: (env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),
  publicApiUrl: (env.PUBLIC_API_URL || "").replace(/\/$/, ""),
  uploadDir: env.UPLOAD_DIR || "uploads",
  smtp: {
    host: env.SMTP_HOST || "",
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || "",
    password: env.SMTP_PASSWORD || "",
    secure: bool(env.SMTP_SECURE, false),
  },
  defaultFromEmail: env.DEFAULT_FROM_EMAIL || "ThermaTrust <noreply@thermatrust.local>",
  alertsCronToken: env.ALERTS_CRON_TOKEN || "",
  anthropicApiKey: env.ANTHROPIC_API_KEY || "",
  ocrModel: env.CREDENTIAL_OCR_MODEL || "claude-opus-5-5",
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY || "",
    privateKey: env.VAPID_PRIVATE_KEY || "",
    contact: env.VAPID_CONTACT || "mailto:admin@thermatrust.local",
  },
  pushSendAsync: bool(env.PUSH_SEND_ASYNC, true),
  trustProxy: bool(env.TRUST_PROXY, env.NODE_ENV === "production"),
};

/** Refuse to boot in production with a guessable signing secret. */
export function assertProductionSafe() {
  if (config.env !== "production") return;

  if (config.jwtSecret.length < 50 || /^(dev-only|change-me|your-)/i.test(config.jwtSecret)) {
    throw new Error("JWT_SECRET must be a unique random string of at least 50 characters in production.");
  }
  if (!config.mongoUri.startsWith("mongodb") || /localhost|127\.0\.0\.1/i.test(config.mongoUri)) {
    throw new Error("MONGODB_URI must point to the production MongoDB service.");
  }
  if (!config.corsOrigins.length || config.corsOrigins.some((origin) => origin === "*" || /localhost|127\.0\.0\.1/i.test(origin))) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain only explicit production frontend origins.");
  }
  if (!config.frontendUrl.startsWith("https://")) {
    throw new Error("FRONTEND_URL must be the HTTPS production frontend URL.");
  }
}
