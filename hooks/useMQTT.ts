"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

export const useMQTT = (stationId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.io");
    });

    if (stationId) {
      // Listen to specific station updates
      newSocket.on(`station:${stationId}:live`, (data) => {
        setLiveData(data);
      });

      newSocket.on(`station:${stationId}:status`, (data) => {
        setStatus(data.status);
      });

      newSocket.on(`station:${stationId}:alerts`, (data) => {
        setAlerts((prev) => [data, ...prev].slice(0, 10));
      });
    } else {
      // Listen to all live updates (for dashboard overview)
      newSocket.on("live_updates", (update) => {
        setLiveData(update);
      });
    }

    return () => {
      newSocket.disconnect();
    };
  }, [stationId]);

  return { socket, liveData, status, alerts };
};
