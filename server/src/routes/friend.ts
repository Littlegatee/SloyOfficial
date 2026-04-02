import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

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
        status: f.status,
        friend_id: otherUser.id, // Ensure we use user.id, not friendship.friend_id
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
      data: { 
        id: crypto.randomUUID(),
        user_id: userId, 
        friend_id: friendUserId,
        status: 'PENDING'
      },
    });
    res.json(friendship);
  } catch (error: any) {
    res.status(400).json({ 
      error: error.message,
      details: error.code === 'P2002' ? 'Request already exists' : error.message 
    });
  }
});

// Accept request
router.put('/:id/accept', authenticateToken, async (req: any, res) => {
  const friendshipId = req.params.id;
  try {
    const friendship = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
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

// Get friendship status with another user
router.get('/status/:userId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const targetUserId = req.params.userId;
  try {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user_id: userId, friend_id: targetUserId },
          { user_id: targetUserId, friend_id: userId },
        ],
      },
    });
    res.json({ status: friendship?.status || null, friendshipId: friendship?.id || null });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send/Request friendship
router.post('/request/:userId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const targetUserId = req.params.userId;
  
  console.log(`Friend request from ${userId} to ${targetUserId}`);

  if (userId === targetUserId) {
    return res.status(400).json({ error: "Cannot friend yourself" });
  }

  try {
    const targetProfile = await prisma.profile.findUnique({
      where: { user_id: targetUserId },
    });
    if (targetProfile && targetProfile.allow_friend_requests === false) {
      return res.status(403).json({ error: "Пользователь не принимает заявки в друзья" });
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user_id: userId, friend_id: targetUserId },
          { user_id: targetUserId, friend_id: userId },
        ],
      },
    });

    if (existing) {
      console.log(`Friendship exists: ${existing.status}`);
      return res.status(400).json({ error: `Friendship already exists or pending (${existing.status})` });
    }

    const friendship = await prisma.friendship.create({
      data: { 
        id: crypto.randomUUID(),
        user_id: userId, 
        friend_id: targetUserId,
        status: 'PENDING'
      },
    });
    res.json(friendship);
  } catch (error: any) {
    console.error("Friend request error details:", error);
    res.status(400).json({ 
      error: error.message,
      details: error.code === 'P2002' ? 'Request already exists' : error.message 
    });
  }
});

// Cancel/Remove friendship
router.post('/cancel/:userId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const targetUserId = req.params.userId;
  try {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user_id: userId, friend_id: targetUserId },
          { user_id: targetUserId, friend_id: userId },
        ],
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Remove friendship (alias for cancel for consistency)
router.post('/remove/:userId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const targetUserId = req.params.userId;
  try {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user_id: userId, friend_id: targetUserId },
          { user_id: targetUserId, friend_id: userId },
        ],
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
