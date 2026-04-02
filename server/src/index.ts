import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { initSocket } from './socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = initSocket(httpServer);

// Presence (in-memory). For production consider Redis/shared store.
const onlineByUserId = new Map<string, { sockets: Set<string>; lastSeen: number | null }>();
const setOnline = (userId: string, socketId: string) => {
  const entry = onlineByUserId.get(userId) || { sockets: new Set<string>(), lastSeen: null };
  entry.sockets.add(socketId);
  entry.lastSeen = null;
  onlineByUserId.set(userId, entry);
};
const setOfflineIfNoSockets = (userId: string) => {
  const entry = onlineByUserId.get(userId);
  if (!entry) return;
  if (entry.sockets.size === 0) {
    entry.lastSeen = Date.now();
    onlineByUserId.set(userId, entry);
  }
};
const isOnline = (userId: string) => {
  const entry = onlineByUserId.get(userId);
  return !!entry && entry.sockets.size > 0;
};

const corsOriginsRaw = (process.env['CORS_ORIGINS'] || '').trim();
const corsOrigins =
  corsOriginsRaw === '*'
    ? '*'
    : corsOriginsRaw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

app.use(
  cors({
    origin:
      corsOrigins === '*'
        ? true
        : corsOrigins.length > 0
          ? corsOrigins
          : ['http://localhost:8080', 'http://127.0.0.1:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Load routes dynamically to prevent circular dependency / TDZ issues
const { default: authRoutes } = await import('./routes/auth.js');
const { default: profileRoutes } = await import('./routes/profile.js');
const { default: postRoutes } = await import('./routes/post.js');
const { default: messageRoutes } = await import('./routes/message.js');
const { default: friendRoutes } = await import('./routes/friend.js');
const { default: communityRoutes } = await import('./routes/community.js');
const { default: musicRoutes } = await import('./routes/music.js');
const { default: adminRoutes } = await import('./routes/admin.js');
const { default: pushRoutes } = await import('./routes/push.js');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);

// Socket.io
io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);
  let joinedUserId: string | null = null;

  socket.on('join', (userId: string) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
    joinedUserId = userId;
    setOnline(userId, socket.id);
    io.emit('presence_update', { userId, online: true, lastSeen: null });
  });

  socket.on('send_message', (data: any) => {
    io.to(data.recipient_id).emit('receive_message', data);
  });

  socket.on('typing', ({ toUserId, fromUserId }: { toUserId: string; fromUserId: string }) => {
    io.to(toUserId).emit('typing', { fromUserId });
  });

  socket.on('stop_typing', ({ toUserId, fromUserId }: { toUserId: string; fromUserId: string }) => {
    io.to(toUserId).emit('stop_typing', { fromUserId });
  });

  socket.on('recording_start', ({ toUserId, fromUserId, kind }: { toUserId: string; fromUserId: string; kind: 'VOICE' | 'VIDEO' }) => {
    io.to(toUserId).emit('recording_start', { fromUserId, kind });
  });

  socket.on('recording_stop', ({ toUserId, fromUserId, kind }: { toUserId: string; fromUserId: string; kind: 'VOICE' | 'VIDEO' }) => {
    io.to(toUserId).emit('recording_stop', { fromUserId, kind });
  });

  socket.on('presence_request', ({ userIds }: { userIds: string[] }) => {
    const snapshot = userIds.map((uid) => {
      const entry = onlineByUserId.get(uid);
      return {
        userId: uid,
        online: isOnline(uid),
        lastSeen: entry?.lastSeen ?? null,
      };
    });
    socket.emit('presence_snapshot', snapshot);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (joinedUserId) {
      const entry = onlineByUserId.get(joinedUserId);
      if (entry) {
        entry.sockets.delete(socket.id);
        onlineByUserId.set(joinedUserId, entry);
      }
      setOfflineIfNoSockets(joinedUserId);
      const lastSeen = onlineByUserId.get(joinedUserId)?.lastSeen ?? Date.now();
      if (!isOnline(joinedUserId)) {
        io.emit('presence_update', { userId: joinedUserId, online: false, lastSeen });
      }
    }
  });
});

const PORT = process.env['PORT'] || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
