import api from "@/lib/api";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as any).standalone === true;

  if (!window.isSecureContext) {
    throw new Error("Push работает только по HTTPS");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push не поддерживается на этом устройстве");
  }
  if (!("Notification" in window)) {
    throw new Error("Уведомления не поддерживаются в этом браузере");
  }
  if (isIos && !isStandalone) {
    throw new Error("На iPhone сначала добавьте сайт на экран Домой, затем включите push");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Разрешение на уведомления не выдано");
  }

  const { data: config } = await api.get("/push/config");
  if (!config?.enabled || !config?.publicKey) {
    throw new Error("Push пока не настроен на сервере");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.publicKey),
    });
  }

  await api.post("/push/subscribe", { subscription: subscription.toJSON() });
  return subscription;
}

export async function unregisterPushNotifications() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await api.post("/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  }
}

export async function sendPushTestNotification() {
  await api.post("/push/test");
}

/** True if browser has an active push subscription (after user granted & subscribed). */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}
