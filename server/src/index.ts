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

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Load routes dynamically to prevent circular dependency / TDZ issues
const { default: authRoutes } = await import('./routes/auth.js');
const { default: profileRoutes } = await import('./routes/profile.js');
const { default: postRoutes } = await import('./routes/post.js');
const { default: messageRoutes } = await import('./routes/message.js');
const { default: friendRoutes } = await import('./routes/friend.js');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);

// Socket.io
io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId: string) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('send_message', (data: any) => {
    io.to(data.recipient_id).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env['PORT'] || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
