"use client";

import { useRealtime } from "@/components/RealtimeProvider";
import { Badge } from "@/components/ui/badge";

export function ReconnectBanner() {
  const { connected } = useRealtime();

  if (connected) return null;

  return (
    <div className="w-full px-6 py-2 border-b bg-warning/10 flex items-center justify-between">
      <div className="text-sm text-muted-foreground">Real-time connection lost. Reconnecting…</div>
      <Badge variant="outline" className="border-warning text-warning">Offline</Badge>
    </div>
  );
}

