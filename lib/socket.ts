import { io, Socket } from "socket.io-client";

// Socket.io lives on the Express backend, so it must connect to the backend host directly
// (Next.js does not proxy WebSockets). Order: explicit socket URL → backend API URL → local dev.
const clean = (url?: string) =>
  url && url !== "undefined" && url !== "null" && url.trim() !== "" ? url.replace(/\/$/, "") : "";

const SOCKET_URL =
  clean(process.env.NEXT_PUBLIC_SOCKET_URL) ||
  clean(process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:5000";

let socket: Socket | null = null;

const currentToken = () => {
  if (typeof window === "undefined") return undefined;
  const t = localStorage.getItem("token");
  return t && t !== "null" && t !== "undefined" ? t : undefined;
};

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      // Re-read on every (re)connect so the server can put us in our private rooms
      // (owner → own stations' events, admin → everything).
      auth: (cb) => cb({ token: currentToken() }),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socket;
};

/** Call after login/logout so the server re-evaluates which rooms this socket belongs to. */
export const reconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
};
