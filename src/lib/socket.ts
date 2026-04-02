import { io } from 'socket.io-client';
import { reportClientError } from "@/lib/monitoring";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 15000,
  timeout: 25000,
  transports: ["websocket", "polling"],
});

socket.on("connect_error", (err) => {
  reportClientError(err, { source: "socket.connect_error" });
});
