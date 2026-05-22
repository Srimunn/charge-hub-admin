"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getStationById } from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

export default function StationDetailPage() {
  const params = useParams();
  const stationId = params.stationId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const stationQuery = useQuery({
    queryKey: ["station", stationId],
    queryFn: () => getStationById(stationId),
    enabled: Boolean(stationId),
  });

  useQuery({
    queryKey: ["liveTelemetry"],
    queryFn: async () => ({}),
    initialData: {},
    staleTime: Infinity,
  });

  const station = stationQuery.data as any;
  const telemetryMap = (queryClient.getQueryData(["liveTelemetry"]) || {}) as Record<string, any>;
  const telemetry = station?._id ? telemetryMap?.[station._id] : undefined;

  useEffect(() => {
    if (!stationId) return;
    const socket = getSocket();
    socket.emit("join_station", stationId);
    return () => {
      socket.emit("leave_station", stationId);
    };
  }, [stationId]);

  const connectors = useMemo(() => {
    if (!Array.isArray(station?.connectors)) return [];
    return [...station.connectors].sort((a: any, b: any) => Number(a.connectorId) - Number(b.connectorId));
  }, [station?.connectors]);

  if (stationQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading station details…</div>;
  }

  if (stationQuery.isError || !station) {
    return (
      <div className="flex flex-col min-h-screen">
        <DashboardHeader title="Station Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Station not found</h2>
            <Button onClick={() => router.push("/stations")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Stations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title={station.name} subtitle={station.location} />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push("/stations")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Stations
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono font-bold">{station.stationNumber}</Badge>
            <Badge variant="outline" className={station.ocppConnected ? "border-success text-success" : "border-muted text-muted-foreground"}>
              {station.ocppConnected ? "OCPP Connected" : "OCPP Disconnected"}
            </Badge>
            <Badge variant="outline" className={station.status === "online" ? "border-success text-success" : "border-destructive text-destructive"}>
              {station.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Live Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Voltage</p>
                <p className="text-lg font-semibold font-mono">{telemetry?.voltage ?? "—"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-lg font-semibold font-mono">{telemetry?.current ?? "—"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Power (kW)</p>
                <p className="text-lg font-semibold font-mono">{telemetry?.power ?? "—"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Energy Delivered</p>
                <p className="text-lg font-semibold font-mono">{telemetry?.energyDelivered ?? "—"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Temperature</p>
                <p className="text-lg font-semibold font-mono">{telemetry?.temperature ?? "—"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Transaction</p>
                <p className="text-lg font-semibold font-mono">{telemetry?.transactionId ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connectors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {connectors.length === 0 ? (
                <div className="text-sm text-muted-foreground">No connector status yet.</div>
              ) : (
                connectors.map((c: any) => (
                  <div key={String(c.connectorId)} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">#{c.connectorId}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{c.status || "Unknown"}</Badge>
                      {c.errorCode && c.errorCode !== "NoError" ? (
                        <Badge variant="outline" className="border-destructive text-destructive">{c.errorCode}</Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

