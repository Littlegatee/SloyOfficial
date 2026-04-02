import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticateToken, async (req: any, res) => {
  const email = req.user?.email as string | undefined;
  res.json({ isAdmin: isAdminEmail(email) });
});

function isAdminEmail(email: string | undefined) {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS || '';
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// Toggle verification (галочка) — только email из ADMIN_EMAILS в .env
router.post('/users/:userId/verification', authenticateToken, async (req: any, res) => {
  const email = req.user?.email as string | undefined;
  if (!isAdminEmail(email)) {
    return res.status(403).json({ error: 'Только администратор может выдавать верификацию' });
  }
  const { verified } = req.body || {};
  const target = req.params.userId as string;
  try {
    const profile = await prisma.profile.update({
      where: { user_id: target },
      data: { is_verified: verified !== false },
    });
    res.json(profile);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
