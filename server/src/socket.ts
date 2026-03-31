import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  const corsOriginsRaw = (process.env['CORS_ORIGINS'] || '').trim();
  const corsOrigin =
    corsOriginsRaw === '*'
      ? true
      : corsOriginsRaw
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin:
        corsOrigin === true
          ? true
          : corsOrigin.length > 0
            ? corsOrigin
            : ['http://localhost:8080', 'http://127.0.0.1:8080'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
  });
  return io;
};
