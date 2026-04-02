import prisma from "../prisma.js";
import { sendWebPushNotification } from "./webPush.js";

export async function notifyUserByPush(
  userId: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  }
) {
  const rows = await prisma.pushSubscription.findMany({
    where: { user_id: userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (!rows.length) return;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await sendWebPushNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          {
            title: payload.title,
            body: payload.body,
            url: payload.url || "/messages",
            tag: payload.tag || "message",
          }
        );
      } catch (error: any) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: row.id } }).catch(() => undefined);
        }
      }
    })
  );
}
