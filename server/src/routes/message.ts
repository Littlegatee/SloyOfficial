import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { io } from '../index.js';

const router = express.Router();

// Get dialogs
router.get('/dialogs', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ sender_id: userId }, { recipient_id: userId }],
      },
      include: {
        sender: { include: { profile: true } },
        recipient: { include: { profile: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const dialogMap: Record<string, any> = {};
    for (const msg of messages) {
      const otherUser = msg.sender_id === userId ? msg.recipient : msg.sender;
      if (!dialogMap[otherUser.id]) {
        dialogMap[otherUser.id] = {
          userId: otherUser.id,
          username: otherUser.profile?.username,
          first_name: otherUser.profile?.first_name,
          lastMessage: msg.content_text,
          unreadCount: messages.filter((m: any) => m.sender_id === otherUser.id && m.recipient_id === userId && !m.is_read).length,
          time: msg.created_at,
        };
      }
    }
    res.json(Object.values(dialogMap));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get chat with user
router.get('/:userId', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  try {
    await prisma.message.updateMany({
      where: { sender_id: otherId, recipient_id: myId, is_read: false },
      data: { is_read: true },
    });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { sender_id: myId, recipient_id: otherId },
          { sender_id: otherId, recipient_id: myId },
        ],
      },
      orderBy: { created_at: 'asc' },
    });
    res.json(messages);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send message
router.post('/', authenticateToken, async (req: any, res) => {
  const { recipient_id, content_text } = req.body;
  const sender_id = req.user.id;
  try {
    const message = await prisma.message.create({
      data: { sender_id, recipient_id, content_text },
    });
    io.to(recipient_id).emit('receive_message', message);
    res.json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
