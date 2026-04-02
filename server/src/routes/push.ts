import express from "express";
import prisma from "../prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { getWebPushPublicKey, isWebPushConfigured, sendWebPushNotification } from "../lib/webPush.js";

const router = express.Router();

router.get("/config", authenticateToken, async (_req: any, res) => {
  res.json({
    enabled: isWebPushConfigured(),
    publicKey: getWebPushPublicKey() || null,
  });
});

router.post("/subscribe", authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const sub = req.body?.subscription;
  const endpoint = String(sub?.endpoint || "");
  const p256dh = String(sub?.keys?.p256dh || "");
  const auth = String(sub?.keys?.auth || "");

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "Invalid subscription payload" });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
      },
      update: {
        user_id: userId,
        p256dh,
        auth,
        user_agent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/unsubscribe", authenticateToken, async (req: any, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/test", authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const rows = await prisma.pushSubscription.findMany({
      where: { user_id: userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    await Promise.all(
      rows.map((row) =>
        sendWebPushNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          { title: "Sloy", body: "Тест push работает", url: "/messages", tag: "test" }
        )
      )
    );
    res.json({ success: true, sent: rows.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
