import { Notification } from "../models/index.js";
import { sendPush } from "./push.js";

/**
 * Store an in-app notification for a user and, when push is configured, also
 * send it to their devices. Returns the notification, or null when there is
 * nobody to tell. Delivery problems never propagate.
 */
export async function notify(userId, kind, title, body = "", link = "") {
  if (userId === null || userId === undefined) return null;
  const notification = await Notification.create({
    user: userId,
    kind,
    title: String(title).slice(0, 200),
    body: String(body).slice(0, 300),
    link: String(link).slice(0, 200),
  });
  try {
    await sendPush(notification.toObject());
  } catch (error) {
    console.warn("[notify] push failed:", error.message);
  }
  return notification;
}
