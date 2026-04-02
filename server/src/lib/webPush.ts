import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"] || "";
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] || "";
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] || "mailto:admin@sloy.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function isWebPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getWebPushPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export async function sendWebPushNotification(
  subscription: webpush.PushSubscription,
  payload: Record<string, unknown>
) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60,
    urgency: "high",
  });
}
