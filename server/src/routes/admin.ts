import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const email = user?.email;
  res.json({ isAdmin: (user as any)?.is_admin || isAdminEmail(email) });
});

// Get system stats
router.get('/stats', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!(user as any)?.is_admin && !isAdminEmail(user?.email)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const userCount = await prisma.user.count();
    const postCount = await prisma.post.count();
    const communityCount = await (prisma as any).community.count();
    const messageCount = await prisma.message.count();

    res.json({
      users: userCount,
      posts: postCount,
      communities: communityCount,
      messages: messageCount,
      recentUsers: await prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { profile: true }
      }),
      recentCommunities: await (prisma as any).community.findMany({
        take: 5,
        orderBy: { created_at: 'desc' }
      })
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle community verification
router.post('/communities/:communityId/verification', authenticateToken, async (req: any, res) => {
  const userId = req.user?.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!(user as any)?.is_admin && !isAdminEmail(user?.email)) {
    return res.status(403).json({ error: 'Только администратор может выдавать верификацию' });
  }
  const { verified } = req.body || {};
  const communityId = req.params.communityId;
  try {
    const community = await (prisma as any).community.update({
      where: { id: communityId },
      data: { is_verified: verified !== false },
    });
    res.json(community);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
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
