import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get friends
router.get('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user_id: userId }, { friend_id: userId }],
      },
      include: {
        user: { include: { profile: true } },
        friend: { include: { profile: true } },
      },
    });

    const items = friendships.map((f: any) => {
      const otherUser = f.user_id === userId ? f.friend : f.user;
      return {
        id: f.id,
        user_id: f.user_id,
        friend_id: f.friend_id,
        status: f.status,
        friend_profile: otherUser.profile,
        direction: f.user_id === userId ? 'sent' : 'received',
      };
    });
    res.json(items);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send request
router.post('/', authenticateToken, async (req: any, res) => {
  const { friendUserId } = req.body;
  const userId = req.user.id;
  try {
    const friendship = await prisma.friendship.create({
      data: { user_id: userId, friend_id: friendUserId },
    });
    res.json(friendship);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Accept request
router.put('/:id/accept', authenticateToken, async (req: any, res) => {
  const friendshipId = req.params.id;
  try {
    const friendship = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted' },
    });
    res.json(friendship);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Remove friendship
router.delete('/:id', authenticateToken, async (req: any, res) => {
  const friendshipId = req.params.id;
  try {
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
