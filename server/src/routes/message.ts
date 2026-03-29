import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { io } from '../socket.js';

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
          avatar_url: otherUser.profile?.avatar_url,
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

// Mark messages as read
router.post('/:userId/read', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  try {
    await prisma.message.updateMany({
      where: { sender_id: otherId, recipient_id: myId, is_read: false },
      data: { is_read: true },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send message
router.post('/', authenticateToken, async (req: any, res) => {
  const { recipient_id, content_text, message_type = 'TEXT', media_url, voice_duration } = req.body;
  const sender_id = req.user.id;
  try {
    // Check if they are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { user_id: sender_id, friend_id: recipient_id },
          { user_id: recipient_id, friend_id: sender_id },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({ error: "Вы можете отправлять сообщения только друзьям" });
    }

    const message = await prisma.message.create({
      data: { 
        sender_id, 
        recipient_id, 
        content_text,
        message_type,
        media_url,
        voice_duration
      },
    });
    
    // Emit to recipient
    io.to(recipient_id).emit('receive_message', message);
    
    res.json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Edit message
router.patch('/:id', authenticateToken, async (req: any, res) => {
  const { content_text } = req.body;
  const messageId = req.params.id;
  const userId = req.user.id;
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.sender_id !== userId) {
      return res.status(403).json({ error: "Вы можете редактировать только свои сообщения" });
    }

    if (message.message_type !== 'TEXT') {
      return res.status(400).json({ error: "Редактировать можно только текстовые сообщения" });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { 
        content_text,
        is_edited: true 
      },
    });

    // Notify recipient about edit via socket if needed
    io.to(message.recipient_id).emit('message_edited', updatedMessage);

    res.json(updatedMessage);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete message
router.delete('/:id', authenticateToken, async (req: any, res) => {
  const messageId = req.params.id;
  const userId = req.user.id;
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }

    // Allow deleting if user is sender OR recipient (delete for self)
    // For simplicity, let's delete for both if sender deletes, 
    // but the prompt implies deleting from the chat.
    if (message.sender_id !== userId && message.recipient_id !== userId) {
      return res.status(403).json({ error: "Нет прав для удаления этого сообщения" });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    // Notify other party about deletion
    const otherId = message.sender_id === userId ? message.recipient_id : message.sender_id;
    io.to(otherId).emit('message_deleted', messageId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete entire chat
router.delete('/chat/:userId', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  try {
    await prisma.message.deleteMany({
      where: {
        OR: [
          { sender_id: myId, recipient_id: otherId },
          { sender_id: otherId, recipient_id: myId },
        ],
      },
    });

    // Notify other party that chat was deleted? 
    // Usually it's better to just delete for oneself, but the prompt says "полное удаление чата"
    io.to(otherId).emit('chat_deleted', myId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
