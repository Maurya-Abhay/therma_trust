import { fetchPushKey, subscribePush, unsubscribePush } from "../api/endpoints";

/** Browser push needs a service worker, the Push API and Notifications. Plain pages and old browsers lack one. */
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhones only allow web push for sites added to the home screen. */
export function needsHomeScreenInstall() {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function urlBase64ToUint8Array(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function registration() {
  // `ready` never resolves when no worker is registered (e.g. dev mode), so don't hang the UI on it.
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export type EnableResult = "enabled" | "denied" | "unavailable";

/** Ask permission, subscribe this browser and register it with the server. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return "unavailable";
  const reg = await registration();
  if (!reg) return "unavailable";

  const key = await fetchPushKey();
  if (!key.enabled || !key.public_key) return "unavailable";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key.public_key),
    }));

  await subscribePush(subscription.toJSON());
  return "enabled";
}

/** Stop alerts on this device: tell the server first (it needs the sign-in), then drop the browser subscription. */
export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await unsubscribePush(subscription.endpoint);
  } finally {
    await subscription.unsubscribe().catch(() => false);
  }
}
