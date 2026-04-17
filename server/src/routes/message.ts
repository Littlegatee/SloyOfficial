import express from 'express';
import prisma, { withDbReconnectRetry } from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { io } from '../socket.js';
import { notifyUserByPush } from '../lib/pushNotify.js';

import { getLinkPreview } from 'link-preview-js';

const router = express.Router();

function clampInt(value: any, min: number, max: number, fallback: number) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Get dialogs
router.get('/dialogs', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const me = await withDbReconnectRetry(() => prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }));

    const pins = await withDbReconnectRetry(() => prisma.dialogPin.findMany({
      where: { user_id: userId },
      select: { other_user_id: true },
    }));
    const pinnedSet = new Set(pins.map(p => p.other_user_id));

    // Some deployments may not have the dialogMute table yet.
    // If it is missing, we still return dialogs (without mute info) instead of failing the whole endpoint.
    let mutes: Array<{ other_user_id: string; muted_until: Date | null; muted_forever: boolean }> = [];
    try {
      mutes = await prisma.dialogMute.findMany({
        where: { user_id: userId },
        select: { other_user_id: true, muted_until: true, muted_forever: true },
      });
    } catch (e) {
      console.warn("dialogMute unavailable, returning dialogs without mute info", e);
    }
    const muteByOtherId = new Map(mutes.map(m => [m.other_user_id, m]));

    // Same approach for dialogArchive: don't break dialogs listing if the table is missing.
    let archives: Array<{ other_user_id: string }> = [];
    try {
      archives = await prisma.dialogArchive.findMany({
        where: { user_id: userId },
        select: { other_user_id: true },
      });
    } catch (e) {
      console.warn("dialogArchive unavailable, returning dialogs without archive info", e);
    }
    const archivedSet = new Set(archives.map(a => a.other_user_id));

    const messages = await withDbReconnectRetry(() => prisma.message.findMany({
      where: {
        OR: [{ sender_id: userId }, { recipient_id: userId }],
        NOT: {
          hiddenBy: { some: { user_id: userId } }
        }
      },
      include: {
        sender: { include: { profile: true } },
        recipient: { include: { profile: true } },
      },
      orderBy: { created_at: 'desc' },
    }));

    const dialogMap: Record<string, any> = {};
    const unreadCountByOtherId: Record<string, number> = {};

    // One pass count of unread inbound messages per other user
    for (const msg of messages) {
      if (msg.recipient_id === userId && !msg.is_read) {
        const otherId = msg.sender_id;
        unreadCountByOtherId[otherId] = (unreadCountByOtherId[otherId] || 0) + 1;
      }
    }

    for (const msg of messages) {
      const otherUser = msg.sender_id === userId ? msg.recipient : msg.sender;
      if (!dialogMap[otherUser.id]) {
        const mute = muteByOtherId.get(otherUser.id);
        const mutedUntil = mute?.muted_until ?? null;
        const mutedForever = Boolean(mute?.muted_forever);
        const muted =
          mutedForever || (mutedUntil ? new Date(mutedUntil).getTime() > Date.now() : false);
        const unreadCount = muted ? 0 : (unreadCountByOtherId[otherUser.id] || 0);

        dialogMap[otherUser.id] = {
          userId: otherUser.id,
          username: otherUser.profile?.username,
          first_name: otherUser.profile?.first_name,
          avatar_url: otherUser.profile?.avatar_url,
          lastMessage: msg.content_text,
          unreadCount,
          time: msg.created_at,
          pinned: pinnedSet.has(otherUser.id),
          mutedUntil,
          mutedForever,
          muted,
          archived: archivedSet.has(otherUser.id),
        };
      }
    }

    // Saved Messages ("Избранное") — always present as a self-chat
    const latestSelf = await withDbReconnectRetry(() => prisma.message.findFirst({
      where: { sender_id: userId, recipient_id: userId },
      orderBy: { created_at: 'desc' },
      select: { content_text: true, created_at: true },
    }));
    const saved = {
      userId,
      username: me?.profile?.username || '',
      first_name: 'Избранное',
      avatar_url: me?.profile?.avatar_url || null,
      lastMessage: latestSelf?.content_text || 'Saved Messages',
      unreadCount: 0,
      time: latestSelf?.created_at || new Date(),
      pinned: true,
      muted: false,
      mutedUntil: null,
      mutedForever: false,
      archived: false,
      isSaved: true,
    };

    const values = Object.values(dialogMap).filter((d: any) => d.userId !== userId);
    res.json([saved, ...values]);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Search messages in chat (server-side)
router.get('/:userId/search', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  const q = String(req.query.q || '').trim();
  const take = clampInt(req.query.take, 1, 50, 20);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;

  if (!q) return res.json({ messages: [], nextCursor: null });

  try {
    const cursorMessage = cursor ? await prisma.message.findUnique({ where: { id: cursor } }) : null;
    const cursorCreatedAt = cursorMessage?.created_at;

    const whereBase: any = {
      AND: [
        {
          OR: [
            { sender_id: myId, recipient_id: otherId },
            { sender_id: otherId, recipient_id: myId },
          ],
        },
        // Only messages that can be searched by text
        { content_text: { not: null } },
        { content_text: { contains: q, mode: 'insensitive' } },
      ],
    };

    if (cursorCreatedAt) {
      whereBase.AND.push({ created_at: { lt: cursorCreatedAt } });
    }

    const page = await prisma.message.findMany({
      where: whereBase,
      include: {
        reply_to: {
          include: { sender: { include: { profile: true } } }
        },
        reactions: { select: { emoji: true, user_id: true } },
      },
      orderBy: { created_at: 'desc' },
      take: take + 1,
    });

    const hasMore = page.length > take;
    const sliced = hasMore ? page.slice(0, take) : page;
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.id : null;

    res.json({ messages: sliced, nextCursor });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Jump to date: load messages for a specific day (ascending)
router.get('/:userId/by-date', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  const dateStr = String(req.query.date || '').trim(); // YYYY-MM-DD
  const take = clampInt(req.query.take, 1, 200, 100);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }

  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  try {
    const where: any = {
      OR: [
        { sender_id: myId, recipient_id: otherId },
        { sender_id: otherId, recipient_id: myId },
      ],
      created_at: { gte: dayStart, lt: dayEnd },
      NOT: { hiddenBy: { some: { user_id: myId } } },
    };

    const page = await prisma.message.findMany({
      where,
      include: {
        reply_to: { include: { sender: { include: { profile: true } } } },
        reactions: { select: { emoji: true, user_id: true } },
      },
      orderBy: { created_at: 'asc' },
      take,
    });

    const nextCursor = page[0]?.id ?? null; // used to load older messages via cursor
    res.json({ messages: page, nextCursor });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get chat with user
router.get('/:userId', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  try {
    const take = clampInt(req.query.take, 1, 100, 50);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const isSelf = myId === otherId;

    // Mark as read (only for messages already delivered in this chat)
    if (!isSelf) {
      await withDbReconnectRetry(() =>
        prisma.message.updateMany({
          where: { sender_id: otherId, recipient_id: myId, is_read: false },
          data: { is_read: true },
        }),
      );
      io.to(otherId).emit('messages_read', myId);
    } else {
      await withDbReconnectRetry(() =>
        prisma.message.updateMany({
          where: { sender_id: myId, recipient_id: myId, is_read: false },
          data: { is_read: true },
        }),
      );
    }

    const cursorMessage = cursor
      ? await withDbReconnectRetry(() => prisma.message.findUnique({ where: { id: cursor } }))
      : null;
    const cursorCreatedAt = cursorMessage?.created_at;

    const where: any = {
      OR: isSelf
        ? [{ sender_id: myId, recipient_id: myId }]
        : [
            { sender_id: myId, recipient_id: otherId },
            { sender_id: otherId, recipient_id: myId },
          ],
      NOT: {
        hiddenBy: { some: { user_id: myId } }
      }
    };

    if (cursorCreatedAt) {
      // Load older than the current oldest message in client
      where.created_at = { lt: cursorCreatedAt };
    }

    // Fetch newest->older for paging, then reverse to keep UI ascending
    const page = await withDbReconnectRetry(() =>
      prisma.message.findMany({
        where,
        include: {
          reply_to: {
            include: {
              sender: { include: { profile: true } }
            }
          },
          reactions: { select: { emoji: true, user_id: true } },
        },
        orderBy: { created_at: 'desc' },
        take: take + 1,
      }),
    );

    const hasMore = page.length > take;
    const sliced = hasMore ? page.slice(0, take) : page;
    const ascending = sliced.reverse();
    const nextCursor = hasMore ? ascending[0]?.id : null;

    res.json({ messages: ascending, nextCursor });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
      
// Toggle reaction for a message (adds/removes emoji reaction by current user)
router.post('/:id/reactions', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const messageId = req.params.id;
  const emoji = String(req.body?.emoji || '').trim();

  if (!emoji || emoji.length > 16) {
    return res.status(400).json({ error: "emoji is required" });
  }

  try {
    const message = await withDbReconnectRetry(() => prisma.message.findUnique({ where: { id: messageId } }));
    if (!message) return res.status(404).json({ error: "Сообщение не найдено" });
    if (message.sender_id !== me && message.recipient_id !== me) {
      return res.status(403).json({ error: "Нет прав" });
    }

    const existing = await withDbReconnectRetry(() => prisma.messageReaction.findUnique({
      where: { message_id_user_id_emoji: { message_id: messageId, user_id: me, emoji } },
    }));

    if (existing) {
      await withDbReconnectRetry(() => prisma.messageReaction.delete({ where: { id: existing.id } }));
    } else {
      await withDbReconnectRetry(() =>
        prisma.messageReaction.create({ data: { message_id: messageId, user_id: me, emoji } }),
      );
    }

    const reactions = await withDbReconnectRetry(() => prisma.messageReaction.findMany({
      where: { message_id: messageId },
      select: { emoji: true, user_id: true },
    }));

    const payload = { messageId, reactions };
    io.to(message.sender_id).emit('message_reactions_updated', payload);
    io.to(message.recipient_id).emit('message_reactions_updated', payload);

    res.json(payload);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Mute/unmute dialog for current user
router.post('/dialogs/:userId/mute', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const other = req.params.userId;
  const mode = String(req.body?.mode || '').trim(); // '1h' | '8h' | 'forever' | 'off'

  try {
    if (mode === 'off') {
      await prisma.dialogMute.deleteMany({ where: { user_id: me, other_user_id: other } });
      return res.json({ muted: false, mutedUntil: null, mutedForever: false });
    }

    let muted_until: Date | null = null;
    let muted_forever = false;

    if (mode === '1h') {
      muted_until = new Date(Date.now() + 60 * 60 * 1000);
    } else if (mode === '8h') {
      muted_until = new Date(Date.now() + 8 * 60 * 60 * 1000);
    } else if (mode === 'forever') {
      muted_forever = true;
    } else {
      return res.status(400).json({ error: "mode must be 1h|8h|forever|off" });
    }

    const row = await prisma.dialogMute.upsert({
      where: { user_id_other_user_id: { user_id: me, other_user_id: other } },
      create: { user_id: me, other_user_id: other, muted_until, muted_forever },
      update: { muted_until, muted_forever },
      select: { muted_until: true, muted_forever: true },
    });

    res.json({
      muted: row.muted_forever || (row.muted_until ? row.muted_until.getTime() > Date.now() : false),
      mutedUntil: row.muted_until,
      mutedForever: row.muted_forever,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Mark messages as read
router.post('/:userId/read', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  try {
    if (myId === otherId) {
      await prisma.message.updateMany({
        where: { sender_id: myId, recipient_id: myId, is_read: false },
        data: { is_read: true },
      });
      return res.json({ success: true });
    }
    await prisma.message.updateMany({
      where: { sender_id: otherId, recipient_id: myId, is_read: false },
      data: { is_read: true },
    });
    io.to(otherId).emit('messages_read', myId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send message
router.post('/', authenticateToken, async (req: any, res) => {
  const { recipient_id, content_text, message_type = 'TEXT', media_url, voice_duration, reply_to_id, album_id, poll } = req.body;
  const sender_id = req.user.id;
  try {
    // Saved Messages (self-chat) is always allowed
    const isSelf = sender_id === recipient_id;

    // Block checks (either side)
    if (!isSelf) {
      const blocked = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: sender_id, blocked_id: recipient_id },
            { blocker_id: recipient_id, blocked_id: sender_id },
          ],
        },
      });
      if (blocked) {
        return res.status(403).json({ error: "Нельзя отправить сообщение: пользователь заблокирован" });
      }
    }

    // Recipient privacy: who can message them
    if (!isSelf) {
      const recipientProfile = await prisma.profile.findUnique({ where: { user_id: recipient_id } });
      const allow = recipientProfile?.allow_messages_from || 'FRIENDS';
      if (allow === 'NOBODY') {
        return res.status(403).json({ error: "Пользователь запретил личные сообщения" });
      }

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

      if (allow === 'FRIENDS' && !friendship) {
        return res.status(403).json({ error: "Вы можете отправлять сообщения только друзьям" });
      }
    }

    // Link Preview logic
    let link_preview = null;
    if (message_type === 'TEXT' && content_text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = content_text.match(urlRegex);
      if (match) {
        try {
          const preview: any = await getLinkPreview(match[0], { timeout: 3000 });
          if (preview && (preview.title || preview.description)) {
            link_preview = {
              url: preview.url,
              title: preview.title || "Ссылка",
              description: preview.description || "",
              image: preview.images?.[0] || preview.favicons?.[0] || null
            };
          }
        } catch (e) {
          console.warn("Failed to fetch link preview:", e);
        }
      }
    }

    const message = await (prisma.message as any).create({
      data: { 
        sender_id, 
        recipient_id, 
        content_text,
        message_type,
        media_url,
        voice_duration,
        reply_to_id,
        album_id,
        link_preview: link_preview as any
      },
      include: {
        reply_to: {
          include: {
            sender: { include: { profile: true } }
          }
        },
        reactions: { select: { emoji: true, user_id: true } }
      }
    });

    // Create poll if provided
    if (message_type === 'TEXT' && poll && poll.question && Array.isArray(poll.options)) {
      await prisma.poll.create({
        data: {
          message_id: message.id,
          question: poll.question,
          options: poll.options as any,
          multiple: !!poll.multiple,
          anonymous: !!poll.anonymous
        }
      });
    }
    
    // Clear draft if it exists
    await prisma.chatDraft.deleteMany({
      where: { user_id: sender_id, recipient_id }
    });

    // Emit to recipient
    io.to(recipient_id).emit('receive_message', message);
    if (!isSelf) {
      const senderProfile = await prisma.profile.findUnique({
        where: { user_id: sender_id },
        select: { first_name: true },
      });
      await notifyUserByPush(recipient_id, {
        title: senderProfile?.first_name || "Новое сообщение", 
        body: content_text || "Новое сообщение в Sloy",
        url: `/messages?userId=${sender_id}`,
        tag: `chat:${sender_id}`,
      });
    }

    // Archive behavior (Telegram-like):
    // If recipient has the sender archived and chat is NOT muted => unarchive on new message.
    if (!isSelf) {
      // Some DB setups may not yet have dialogMute/dialogArchive tables.
      // Don't fail message sending in that case.
      try {
        const mute = await prisma.dialogMute.findUnique({
          where: { user_id_other_user_id: { user_id: recipient_id, other_user_id: sender_id } },
          select: { muted_until: true, muted_forever: true },
        });
        const muted =
          Boolean(mute?.muted_forever) ||
          (mute?.muted_until ? new Date(mute.muted_until).getTime() > Date.now() : false);

        if (!muted) {
          await prisma.dialogArchive.deleteMany({
            where: { user_id: recipient_id, other_user_id: sender_id },
          });
        }
      } catch (e) {
        console.warn("dialogMute/dialogArchive unavailable, skipping mute/unarchive logic", e);
      }
    }
    
    res.json(message);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Drafts API
router.post('/drafts', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  const { recipient_id, content_text, reply_to_id } = req.body;
  try {
    const draft = await prisma.chatDraft.upsert({
      where: { user_id_recipient_id: { user_id, recipient_id } },
      create: { user_id, recipient_id, content_text, reply_to_id },
      update: { content_text, reply_to_id, updated_at: new Date() }
    });
    res.json(draft);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/drafts', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  try {
    const drafts = await prisma.chatDraft.findMany({ where: { user_id } });
    res.json(drafts);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Folders API
router.get('/folders', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  try {
    const folders = await prisma.chatFolder.findMany({
      where: { user_id },
      orderBy: { position: 'asc' }
    });
    res.json(folders);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/folders', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  const { name, icon, filters, position } = req.body;
  try {
    const folder = await prisma.chatFolder.create({
      data: { user_id, name, icon, filters, position: position || 0 }
    });
    res.json(folder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Polls API
router.post('/polls/:pollId/vote', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  const poll_id = req.params.pollId;
  const { option_id } = req.body;
  try {
    const poll = await prisma.poll.findUnique({ where: { id: poll_id } });
    if (!poll) return res.status(404).json({ error: "Опрос не найден" });
    if (poll.closed) return res.status(400).json({ error: "Опрос завершен" });

    if (!poll.multiple) {
      await prisma.pollVote.deleteMany({ where: { poll_id, user_id } });
    }

    const vote = await prisma.pollVote.upsert({
      where: { poll_id_user_id_option_id: { poll_id, user_id, option_id } },
      create: { poll_id, user_id, option_id },
      update: {}
    });

    // Notify participants via socket (optional)
    res.json(vote);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Stickers API
router.get('/sticker-packs', authenticateToken, async (req: any, res) => {
  try {
    const packs = await prisma.stickerPack.findMany({
      include: { stickers: { orderBy: { position: 'asc' } } }
    });
    res.json(packs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Chat Configs API
router.get('/configs/:otherUserId', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  const other_user_id = req.params.otherUserId;
  try {
    const config = await prisma.userChatConfig.findUnique({
      where: { user_id_other_user_id: { user_id, other_user_id } }
    });
    res.json(config || {});
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/configs/:otherUserId', authenticateToken, async (req: any, res) => {
  const user_id = req.user.id;
  const other_user_id = req.params.otherUserId;
  const { bubble_color, text_color, notif_sound } = req.body;
  try {
    const config = await prisma.userChatConfig.upsert({
      where: { user_id_other_user_id: { user_id, other_user_id } },
      create: { user_id, other_user_id, bubble_color, text_color, notif_sound },
      update: { bubble_color, text_color, notif_sound }
    });
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// Archive/unarchive dialog for current user
router.post('/dialogs/:userId/archive', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const other = req.params.userId;
  const archived = Boolean(req.body?.archived);

  if (me === other) {
    return res.status(400).json({ error: "Нельзя архивировать «Избранное»" });
  }

  try {
    if (!archived) {
      await prisma.dialogArchive.deleteMany({ where: { user_id: me, other_user_id: other } });
      return res.json({ archived: false });
    }
    await prisma.dialogArchive.upsert({
      where: { user_id_other_user_id: { user_id: me, other_user_id: other } },
      create: { user_id: me, other_user_id: other },
      update: { archived_at: new Date() },
    });
    res.json({ archived: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Forward message to another user
router.post('/forward', authenticateToken, async (req: any, res) => {
  const sender_id = req.user.id;
  const { message_id, recipient_id } = req.body as { message_id: string; recipient_id: string };
  try {
    const original = await withDbReconnectRetry(() => prisma.message.findUnique({ where: { id: message_id } }));
    if (!original) return res.status(404).json({ error: "Сообщение не найдено" });
    if (original.sender_id !== sender_id && original.recipient_id !== sender_id) {
      return res.status(403).json({ error: "Нет доступа к этому сообщению" });
    }

    // reuse send rules by copying minimal checks
    const blocked = await withDbReconnectRetry(() => prisma.userBlock.findFirst({
      where: {
        OR: [
          { blocker_id: sender_id, blocked_id: recipient_id },
          { blocker_id: recipient_id, blocked_id: sender_id },
        ],
      },
    }));
    if (blocked) {
      return res.status(403).json({ error: "Нельзя переслать: пользователь заблокирован" });
    }

    const recipientProfile = await withDbReconnectRetry(() =>
      prisma.profile.findUnique({ where: { user_id: recipient_id } }),
    );
    const allow = recipientProfile?.allow_messages_from || 'FRIENDS';
    if (allow === 'NOBODY') {
      return res.status(403).json({ error: "Пользователь запретил личные сообщения" });
    }

    const friendship = await withDbReconnectRetry(() => prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { user_id: sender_id, friend_id: recipient_id },
          { user_id: recipient_id, friend_id: sender_id },
        ],
      },
    }));
    if (allow === 'FRIENDS' && !friendship) {
      return res.status(403).json({ error: "Можно пересылать только друзьям" });
    }

    const msg = await withDbReconnectRetry(() => prisma.message.create({
      data: {
        sender_id,
        recipient_id,
        message_type: original.message_type,
        content_text: original.content_text,
        media_url: original.media_url,
        voice_duration: original.voice_duration,
        forwarded_from_id: original.id,
      },
      include: {
        reply_to: { include: { sender: { include: { profile: true } } } },
      },
    }));

    io.to(recipient_id).emit('receive_message', msg);
    res.json(msg);
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

    // Edit time window (15 minutes)
    const ageMs = Date.now() - new Date(message.created_at).getTime();
    if (ageMs > 15 * 60 * 1000) {
      return res.status(400).json({ error: "Редактирование доступно только в течение 15 минут" });
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

// Pin/unpin dialog for current user
router.post('/dialogs/:userId/pin', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const other = req.params.userId;
  try {
    const existing = await prisma.dialogPin.findUnique({
      where: { user_id_other_user_id: { user_id: me, other_user_id: other } },
    });
    if (existing) {
      await prisma.dialogPin.delete({ where: { id: existing.id } });
      return res.json({ pinned: false });
    }
    await prisma.dialogPin.create({ data: { user_id: me, other_user_id: other } });
    res.json({ pinned: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Pin/unpin message for current user
router.post('/:id/pin', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const messageId = req.params.id;
  try {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ error: "Сообщение не найдено" });
    if (message.sender_id !== me && message.recipient_id !== me) {
      return res.status(403).json({ error: "Нет прав" });
    }

    const existing = await prisma.messagePin.findUnique({
      where: { user_id_message_id: { user_id: me, message_id: messageId } },
    });
    if (existing) {
      await prisma.messagePin.delete({ where: { id: existing.id } });
      return res.json({ pinned: false });
    }
    await prisma.messagePin.create({ data: { user_id: me, message_id: messageId } });
    res.json({ pinned: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get pinned messages in dialog
router.get('/:userId/pins', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const other = req.params.userId;
  try {
    const pins = await withDbReconnectRetry(() =>
      prisma.messagePin.findMany({
        where: {
          user_id: me,
          message: {
            OR: [
              { sender_id: me, recipient_id: other },
              { sender_id: other, recipient_id: me },
            ],
          },
        },
        include: { message: true },
        orderBy: { pinned_at: 'desc' },
        take: 20,
      }),
    );
    res.json(pins.map(p => p.message));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete message
router.delete('/:id', authenticateToken, async (req: any, res) => {
  const messageId = req.params.id;
  const userId = req.user.id;
  try {
    const scope = String(req.query.scope || 'everyone'); // 'me' | 'everyone'
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: "Сообщение не найдено" });
    }

    if (message.sender_id !== userId && message.recipient_id !== userId) {
      return res.status(403).json({ error: "Нет прав для удаления этого сообщения" });
    }

    if (scope === 'me') {
      await prisma.messageHidden.upsert({
        where: { message_id_user_id: { message_id: messageId, user_id: userId } },
        create: { message_id: messageId, user_id: userId },
        update: { hidden_at: new Date() }
      });
      res.json({ success: true, scope: 'me' });
      return;
    }

    // everyone: only sender can delete for everyone
    if (message.sender_id !== userId) {
      return res.status(403).json({ error: "Удалить у всех может только отправитель" });
    }

    await prisma.message.delete({ where: { id: messageId } });

    io.to(message.sender_id).emit('message_deleted', { messageId, scope: 'everyone' });
    io.to(message.recipient_id).emit('message_deleted', { messageId, scope: 'everyone' });

    res.json({ success: true, scope: 'everyone' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete entire chat
router.delete('/chat/:userId', authenticateToken, async (req: any, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  try {
    // Fast path: hide all messages in chat for current user using single SQL INSERT..SELECT.
    // Avoids loading all message ids into memory for large chats.
    await prisma.$executeRaw`
      INSERT INTO "MessageHidden" ("message_id", "user_id", "hidden_at")
      SELECT m.id, ${myId}, NOW()
      FROM "Message" m
      WHERE (
        (m.sender_id = ${myId} AND m.recipient_id = ${otherId})
        OR
        (m.sender_id = ${otherId} AND m.recipient_id = ${myId})
      )
      ON CONFLICT ("message_id", "user_id") DO NOTHING
    `;

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
