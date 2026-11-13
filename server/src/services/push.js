import webpush from "web-push";
import { config } from "../config.js";
import { PushSubscription } from "../models/index.js";

/**
 * Browser push delivery (Web Push with VAPID).
 *
 * In-app notifications are the source of truth; push is a best-effort extra that
 * reaches a user's devices when the app is closed. Every failure is swallowed and
 * logged: a push problem must never break the action that triggered it.
 */
const GONE = new Set([404, 410]);

export const pushEnabled = () => Boolean(config.vapid.publicKey && config.vapid.privateKey);

// Replaceable so tests (and any future provider) can observe or stub the network call.
let sender = (subscription, payload) =>
  webpush.sendNotification(subscription, payload, {
    TTL: 60 * 60 * 12,
    timeout: 8000,
    vapidDetails: {
      subject: config.vapid.contact,
      publicKey: config.vapid.publicKey,
      privateKey: config.vapid.privateKey,
    },
  });

export function setPushSender(fn) {
  sender = fn;
}

export function buildPayload(notification) {
  return JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.link || "/",
    kind: notification.kind,
    id: notification._id,
  });
}

async function deliver(rows, payload) {
  const dead = [];
  for (const row of rows) {
    try {
      await sender({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
    } catch (error) {
      if (GONE.has(error?.statusCode)) dead.push(row._id);
      else console.warn(`[push] delivery failed (${error?.statusCode ?? "error"}): ${error?.message}`);
    }
  }
  if (dead.length) await PushSubscription.deleteMany({ _id: { $in: dead } });
}

/** Push a stored notification to its owner's devices. Resolves to how many were attempted. */
export async function sendPush(notification) {
  if (!pushEnabled()) return 0;
  const rows = await PushSubscription.find({ user: notification.user }).lean();
  if (!rows.length) return 0;

  const payload = buildPayload(notification);
  if (!config.pushSendAsync) {
    await deliver(rows, payload);
  } else {
    deliver(rows, payload).catch((error) => console.warn("[push] delivery error:", error.message));
  }
  return rows.length;
}
