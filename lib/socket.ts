import { io, Socket } from "socket.io-client";

let resolvedSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
if (typeof window !== "undefined") {
  const host = window.location.hostname;
  if (host.includes("charge-hub-frontend")) {
    const backendHost = host.replace("charge-hub-frontend", "charge-hub-backend");
    resolvedSocketUrl = `${window.location.protocol}//${backendHost}`;
  } else if (!host.includes("localhost") && !host.includes("127.0.0.1")) {
    resolvedSocketUrl = window.location.origin;
  }
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || resolvedSocketUrl;

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socket;
};
