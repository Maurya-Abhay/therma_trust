import nodemailer from "nodemailer";
import { config } from "../config.js";

/** Messages that were "sent" while no SMTP server was configured. Tests read this; dev logs it. */
export const outbox = [];

let transport = null;
function getTransport() {
  if (!config.smtp.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
  });
  return transport;
}

/** Send a plain-text email. Never throws: a mail outage must not break the action that triggered it. */
export async function sendMail({ to, subject, text }) {
  const message = { from: config.defaultFromEmail, to, subject, text };
  const smtp = getTransport();
  if (!smtp) {
    outbox.push(message);
    if (outbox.length > 100) outbox.shift();
    if (config.env !== "test") console.log(`[email] to=${to} subject="${subject}"\n${text}\n`);
    return true;
  }
  try {
    await smtp.sendMail(message);
    return true;
  } catch (error) {
    console.error("[email] delivery failed:", error.message);
    return false;
  }
}
