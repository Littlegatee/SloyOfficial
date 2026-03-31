import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Block / Unblock user
router.post('/:id/block', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const target = req.params.id as string;
  if (me === target) return res.status(400).json({ error: "Нельзя заблокировать себя" });
  try {
    await prisma.userBlock.upsert({
      where: { blocker_id_blocked_id: { blocker_id: me, blocked_id: target } },
      create: { blocker_id: me, blocked_id: target },
      update: { created_at: new Date() },
    });
    res.json({ blocked: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/block', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const target = req.params.id as string;
  try {
    await prisma.userBlock.deleteMany({
      where: { blocker_id: me, blocked_id: target },
    });
    res.json({ blocked: false });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/blocks/me', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blocker_id: me },
      include: { blocked: { include: { profile: true } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    res.json(blocks.map(b => ({ user_id: b.blocked_id, profile: b.blocked.profile, created_at: b.created_at })));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user profile
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.params.id as string },
      include: {
        user: true,
      },
    });
    // Apply privacy for last seen / online flags (simple: hide values, not the profile itself)
    const me = req.user.id as string;
    const target = req.params.id as string;
    const blocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blocker_id: me, blocked_id: target },
          { blocker_id: target, blocked_id: me },
        ],
      },
    });

    // If blocked either way, still allow profile basics but hide messaging-sensitive fields
    if (blocked && profile) {
      return res.json({
        ...profile,
        allow_online_status: false,
        allow_last_seen: false,
        allow_messages_from: 'NOBODY',
      });
    }

    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update profile
router.put('/:id', authenticateToken, async (req: any, res: any) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const profile = await prisma.profile.update({
      where: { user_id: req.params.id },
      data: req.body,
    });
    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update privacy settings (subset)
router.patch('/:id/privacy', authenticateToken, async (req: any, res: any) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { allow_online_status, allow_last_seen, allow_messages_from } = req.body || {};
  try {
    const updated = await prisma.profile.update({
      where: { user_id: req.params.id },
      data: {
        ...(allow_online_status === undefined ? {} : { allow_online_status: !!allow_online_status }),
        ...(allow_last_seen === undefined ? {} : { allow_last_seen: !!allow_last_seen }),
        ...(allow_messages_from === undefined ? {} : { allow_messages_from }),
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Search profiles
router.get('/', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const searchTerm = String(q).startsWith('@') ? String(q).slice(1) : String(q);

  try {
    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { first_name: { contains: searchTerm, mode: 'insensitive' } },
          { last_name: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
    res.json(profiles);
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
