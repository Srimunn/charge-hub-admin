"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

type RealtimeState = {
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeState>({ connected: false });

const upsertStation = (stations: any[], patch: any) => {
  if (!Array.isArray(stations)) return stations;
  const idx = stations.findIndex((s) => String(s?._id) === String(patch?.stationId));
  if (idx === -1) return stations;
  const next = stations.slice();
  next[idx] = { ...next[idx], ...patch, _id: next[idx]._id };
  return next;
};

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const socket = useMemo(() => getSocket(), []);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const onStationUpdate = (payload: any) => {
      queryClient.setQueryData(["stations"], (prev: any) => upsertStation(prev as any[], payload));
      if (payload?.stationId) {
        queryClient.setQueryData(["station", payload.stationId], (prev: any) => (prev ? { ...prev, ...payload } : prev));
      }
    };

    const onOcppStatus = (payload: any) => {
      queryClient.setQueryData(["ocppStatus"], (prev: any) => ({ ...(prev || {}), [payload.stationNumber]: payload }));
    };

    const onLiveData = (payload: any) => {
      if (payload?.stationId) {
        queryClient.setQueryData(["liveTelemetry"], (prev: any) => ({ ...(prev || {}), [payload.stationId]: payload }));
      }

      queryClient.setQueryData(["liveSessions"], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((s: any) => {
          if (payload?.transactionId && s?.transactionId && Number(s.transactionId) !== Number(payload.transactionId)) return s;
          if (payload?.stationNumber && s?.stationNumber && String(s.stationNumber) !== String(payload.stationNumber)) return s;
          return {
            ...s,
            voltage: payload.voltage ?? s.voltage,
            current: payload.current ?? s.current,
            powerOutput: payload.power ?? s.powerOutput,
            chargingSpeed: payload.power ?? s.chargingSpeed,
            energyDelivered: payload.energyDelivered ?? s.energyDelivered,
            temperature: payload.temperature ?? s.temperature,
          };
        });
      });
    };

    const onTransactionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    };

    const onFaultAlert = (payload: any) => {
      queryClient.setQueryData(["faults"], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        const exists = prev.some((f: any) => String(f?._id) === String(payload?.faultId));
        if (exists) return prev;
        return [{ _id: payload.faultId, ...payload }, ...prev];
      });
      queryClient.invalidateQueries({ queryKey: ["faults"] });
    };

    socket.on("station_update", onStationUpdate);
    socket.on("ocpp_status", onOcppStatus);
    socket.on("live_data", onLiveData);
    socket.on("transaction_update", onTransactionUpdate);
    socket.on("fault_alert", onFaultAlert);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("station_update", onStationUpdate);
      socket.off("ocpp_status", onOcppStatus);
      socket.off("live_data", onLiveData);
      socket.off("transaction_update", onTransactionUpdate);
      socket.off("fault_alert", onFaultAlert);
    };
  }, [queryClient, socket]);

  const value = useMemo(() => ({ connected }), [connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

